import { promises as fs } from "node:fs"
import { existsSync, mkdirSync } from "node:fs"
import { randomUUID } from "node:crypto"
import path from "node:path"
import ts from "typescript"
import type { Plugin, ViteDevServer } from "vite"
import type { IncomingMessage, ServerResponse } from "node:http"

// ---------------------------------------------------------------------------
// bench: derived component manifest + notes API.
// The manifest is NEVER authored. It is regenerated from the TypeScript
// source on every change: props from `<Name>Props` declarations, usage
// sites from a scan of the rest of src/.
// ---------------------------------------------------------------------------

export interface BenchProp {
  name: string
  kind: "enum" | "boolean" | "string" | "number" | "children" | "unsupported"
  options?: string[]
  /** True when enum options are numeric literals; coerce back to number. */
  numeric?: boolean
  optional: boolean
  description?: string
  raw: string
}

export interface BenchUsage {
  file: string
  line: number
  snippet: string
  /** Usage inside the component library itself (composition), not the app. */
  internal?: boolean
}

export interface BenchComponent {
  name: string
  slug: string
  file: string
  description?: string
  props: BenchProp[]
  usages: BenchUsage[]
}

const COMPONENT_DIR = "src/components"
const BENCH_DIR = ".bench"

function classifyType(
  type: ts.TypeNode | undefined
): Pick<BenchProp, "kind" | "options" | "numeric" | "raw"> {
  if (!type) return { kind: "unsupported", raw: "unknown" }
  const raw = type.getText()
  if (type.kind === ts.SyntaxKind.BooleanKeyword) return { kind: "boolean", raw }
  if (type.kind === ts.SyntaxKind.StringKeyword) return { kind: "string", raw }
  if (type.kind === ts.SyntaxKind.NumberKeyword) return { kind: "number", raw }
  if (ts.isUnionTypeNode(type)) {
    const literals: string[] = []
    let numeric = true
    for (const member of type.types) {
      if (ts.isLiteralTypeNode(member) && ts.isStringLiteral(member.literal)) {
        literals.push(member.literal.text)
        numeric = false
      } else if (ts.isLiteralTypeNode(member) && ts.isNumericLiteral(member.literal)) {
        literals.push(member.literal.text)
      } else if (member.kind === ts.SyntaxKind.UndefinedKeyword) {
        continue
      } else {
        return { kind: "unsupported", raw }
      }
    }
    if (literals.length > 0) {
      return { kind: "enum", options: literals, ...(numeric ? { numeric: true } : {}), raw }
    }
  }
  return { kind: "unsupported", raw }
}

function jsDocText(node: ts.Node): string | undefined {
  const docs = (node as { jsDoc?: { comment?: string | ts.NodeArray<ts.JSDocComment> }[] }).jsDoc
  if (!docs || docs.length === 0) return undefined
  const comment = docs[docs.length - 1].comment
  if (typeof comment === "string") return comment
  if (comment) return comment.map((c) => c.getText?.() ?? "").join("")
  return undefined
}

function hasExportModifier(node: ts.Node): boolean {
  const modifiers = (node as { modifiers?: ts.NodeArray<ts.ModifierLike> }).modifiers
  return !!modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
}

function extractProps(
  members: ts.NodeArray<ts.TypeElement> | undefined
): BenchProp[] {
  const props: BenchProp[] = []
  if (!members) return props
  for (const member of members) {
    if (!ts.isPropertySignature(member) || !member.name) continue
    const propName = member.name.getText()
    if (propName === "children") {
      props.push({
        name: "children",
        kind: "children",
        optional: !!member.questionToken,
        description: jsDocText(member),
        raw: member.type?.getText() ?? "JSX.Element",
      })
      continue
    }
    const classified = classifyType(member.type)
    props.push({
      name: propName,
      optional: !!member.questionToken,
      description: jsDocText(member),
      ...classified,
    })
  }
  return props
}

/**
 * Extract EVERY exported capitalized component in a file, each paired with
 * its `<Name>Props` declaration. Files can hold subcomponents
 * (Card + CardHeader) and compound components (Card.Actions = CardActions),
 * and the manifest keeps them all.
 */
function extractComponents(filePath: string, source: string): Omit<BenchComponent, "usages">[] {
  const sf = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)

  const propsByName = new Map<string, ts.NodeArray<ts.TypeElement>>()
  const declared = new Map<string, string | undefined>() // every capitalized fn -> jsdoc
  const exported = new Set<string>()
  // Compound assignments: Card.Actions = CardActions
  const compounds: { name: string; base: string; target: string }[] = []

  const visit = (node: ts.Node) => {
    if (ts.isInterfaceDeclaration(node) && node.name.text.endsWith("Props")) {
      propsByName.set(node.name.text, node.members)
    }
    if (
      ts.isTypeAliasDeclaration(node) &&
      node.name.text.endsWith("Props") &&
      ts.isTypeLiteralNode(node.type)
    ) {
      propsByName.set(node.name.text, node.type.members)
    }
    if (ts.isFunctionDeclaration(node) && node.name && /^[A-Z]/.test(node.name.text)) {
      declared.set(node.name.text, jsDocText(node))
      if (hasExportModifier(node)) exported.add(node.name.text)
    }
    if (ts.isVariableStatement(node)) {
      for (const decl of node.declarationList.declarations) {
        if (ts.isIdentifier(decl.name) && /^[A-Z]/.test(decl.name.text)) {
          declared.set(decl.name.text, jsDocText(node))
          if (hasExportModifier(node)) exported.add(decl.name.text)
        }
      }
    }
    if (
      ts.isExpressionStatement(node) &&
      ts.isBinaryExpression(node.expression) &&
      node.expression.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      ts.isPropertyAccessExpression(node.expression.left) &&
      ts.isIdentifier(node.expression.left.expression) &&
      /^[A-Z]/.test(node.expression.left.expression.text) &&
      /^[A-Z]/.test(node.expression.left.name.text) &&
      ts.isIdentifier(node.expression.right)
    ) {
      compounds.push({
        name: `${node.expression.left.expression.text}.${node.expression.left.name.text}`,
        base: node.expression.left.expression.text,
        target: node.expression.right.text,
      })
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)

  const components: Omit<BenchComponent, "usages">[] = []
  // Compound targets are absorbed into their dotted entry rather than
  // listed twice (CardActions exists in the manifest only as Card.Actions).
  const compoundTargets = new Set(
    compounds.filter((c) => exported.has(c.base)).map((c) => c.target)
  )
  for (const name of exported) {
    if (compoundTargets.has(name)) continue
    components.push({
      name,
      slug: name.toLowerCase(),
      file: filePath,
      description: declared.get(name),
      props: extractProps(propsByName.get(`${name}Props`)),
    })
  }
  // Compound components ride their base's export; props come from the
  // assigned function's own Props declaration.
  for (const compound of compounds) {
    if (!exported.has(compound.base)) continue
    components.push({
      name: compound.name,
      slug: compound.name.toLowerCase().replace(/\./g, "-"),
      file: filePath,
      description: declared.get(compound.target),
      props: extractProps(propsByName.get(`${compound.target}Props`)),
    })
  }
  return components
}

async function listFiles(dir: string, ext: string): Promise<string[]> {
  const out: string[] = []
  const walk = async (d: string) => {
    let entries
    try {
      entries = await fs.readdir(d, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      const full = path.join(d, entry.name)
      if (entry.isDirectory()) await walk(full)
      else if (entry.name.endsWith(ext)) out.push(full)
    }
  }
  await walk(dir)
  return out
}

async function scanUsages(
  root: string,
  components: { name: string; file: string }[]
): Promise<Map<string, BenchUsage[]>> {
  const usages = new Map<string, BenchUsage[]>()
  for (const c of components) usages.set(c.name, [])
  const files = await listFiles(path.join(root, "src"), ".tsx")
  for (const file of files) {
    const rel = path.relative(root, file)
    // The bench's own rendering machinery does not count as usage.
    if (rel.startsWith("src/bench")) continue
    const internal = rel.startsWith(COMPONENT_DIR)
    const source = await fs.readFile(file, "utf8")
    const lines = source.split("\n")
    for (const c of components) {
      if (internal && rel === c.file) continue // a component is not its own usage
      const tag = new RegExp(`<${c.name.replace(/\./g, "\\.")}[\\s/>]`)
      lines.forEach((line, i) => {
        if (tag.test(line)) {
          usages.get(c.name)!.push({
            file: rel,
            line: i + 1,
            snippet: line.trim().slice(0, 120),
            ...(internal ? { internal: true } : {}),
          })
        }
      })
    }
  }
  return usages
}

async function generateManifest(root: string): Promise<void> {
  const componentFiles = await listFiles(path.join(root, COMPONENT_DIR), ".tsx")
  const specs: Omit<BenchComponent, "usages">[] = []
  const warnings: string[] = []
  for (const file of componentFiles) {
    const source = await fs.readFile(file, "utf8")
    for (const spec of extractComponents(file, source)) {
      specs.push({ ...spec, file: path.relative(root, file) })
    }
  }
  // Component names must be unique across the library; de-collide slugs so
  // every component keeps an address, and surface the conflict.
  const bySlug = new Map<string, number>()
  for (const spec of specs) {
    const seen = bySlug.get(spec.slug) ?? 0
    if (seen > 0) {
      warnings.push(`duplicate component name "${spec.name}" (${spec.file}); slug suffixed`)
      spec.slug = `${spec.slug}-${seen + 1}`
    }
    bySlug.set(spec.name.toLowerCase(), seen + 1)
  }
  const usages = await scanUsages(
    root,
    specs.map((s) => ({ name: s.name, file: s.file }))
  )
  const manifest = {
    generatedAt: new Date().toISOString(),
    root,
    ...(warnings.length > 0 ? { warnings } : {}),
    components: specs
      .map((s) => ({ ...s, usages: usages.get(s.name) ?? [] }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  }
  const outDir = path.join(root, BENCH_DIR)
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true })
  await fs.writeFile(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2))
}

// --- notes -----------------------------------------------------------------

interface BenchNote {
  id: string
  component: string
  stateUrl: string
  selector: string
  coords: { x: number; y: number }
  rect?: { x: number; y: number; w: number; h: number }
  text: string
  author: string
  status: "open" | "resolved"
  created: string
  replies?: { id: string; author: string; text: string; created: string }[]
}

function notesPath(root: string, slug: string): string {
  return path.join(root, BENCH_DIR, "notes", `${slug}.json`)
}

async function readNotes(root: string, slug: string): Promise<BenchNote[]> {
  try {
    return JSON.parse(await fs.readFile(notesPath(root, slug), "utf8"))
  } catch {
    return []
  }
}

async function writeNotes(root: string, slug: string, notes: BenchNote[]): Promise<void> {
  const dir = path.join(root, BENCH_DIR, "notes")
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  await fs.writeFile(notesPath(root, slug), JSON.stringify(notes, null, 2))
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = ""
    req.on("data", (chunk) => (body += chunk))
    req.on("end", () => resolve(body))
    req.on("error", reject)
  })
}

function json(res: ServerResponse, status: number, data: unknown): void {
  res.statusCode = status
  res.setHeader("Content-Type", "application/json")
  res.end(JSON.stringify(data))
}

// --- plugin ----------------------------------------------------------------

export function bench(): Plugin {
  let root = ""
  let timer: ReturnType<typeof setTimeout> | undefined

  const regenerate = () => {
    clearTimeout(timer)
    timer = setTimeout(() => {
      generateManifest(root).catch((err) => console.error("[bench] manifest error", err))
    }, 150)
  }

  return {
    name: "bench",
    configResolved(config) {
      root = config.root
    },
    async buildStart() {
      await generateManifest(root)
    },
    // Notes and manifest writes land in .bench/, which is outside the module
    // graph; Vite's default for such files is a full page reload. Suppress it.
    handleHotUpdate(ctx) {
      if (ctx.file.includes(`${path.sep}${BENCH_DIR}${path.sep}`)) return []
    },
    configureServer(server: ViteDevServer) {
      server.watcher.on("all", (_event, file) => {
        if (file.includes(`${path.sep}src${path.sep}`) && file.endsWith(".tsx")) regenerate()
      })

      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url ?? "/", "http://localhost")
        if (!url.pathname.startsWith("/__bench/api/")) return next()

        try {
          if (url.pathname === "/__bench/api/manifest" && req.method === "GET") {
            const manifest = await fs.readFile(path.join(root, BENCH_DIR, "manifest.json"), "utf8")
            res.setHeader("Content-Type", "application/json")
            return res.end(manifest)
          }

          const fixtureMatch = url.pathname.match(/^\/__bench\/api\/fixtures\/([a-z0-9-]+)$/)
          if (fixtureMatch && req.method === "GET") {
            try {
              const fixture = await fs.readFile(
                path.join(root, BENCH_DIR, "fixtures", `${fixtureMatch[1]}.json`),
                "utf8"
              )
              res.setHeader("Content-Type", "application/json")
              return res.end(fixture)
            } catch {
              return json(res, 200, { states: {} })
            }
          }

          const notesMatch = url.pathname.match(/^\/__bench\/api\/notes\/([a-z0-9-]+)$/)
          if (notesMatch && req.method === "GET") {
            return json(res, 200, await readNotes(root, notesMatch[1]))
          }
          if (notesMatch && req.method === "POST") {
            const body = JSON.parse(await readBody(req))
            const note: BenchNote = {
              id: `note_${randomUUID().slice(0, 8)}`,
              component: notesMatch[1],
              stateUrl: body.stateUrl ?? "",
              selector: body.selector ?? "",
              coords: body.coords ?? { x: 0.5, y: 0.5 },
              rect: body.rect,
              text: body.text ?? "",
              author: body.author ?? "human",
              status: "open",
              created: new Date().toISOString(),
            }
            const notes = await readNotes(root, notesMatch[1])
            notes.push(note)
            await writeNotes(root, notesMatch[1], notes)
            return json(res, 201, note)
          }

          const moveMatch = url.pathname.match(/^\/__bench\/api\/notes\/([a-z0-9-]+)\/move$/)
          if (moveMatch && req.method === "POST") {
            const body = JSON.parse(await readBody(req))
            const notes = await readNotes(root, moveMatch[1])
            const note = notes.find((n) => n.id === body.id)
            if (!note) return json(res, 404, { error: "note not found" })
            note.coords = body.coords
            if (body.rect !== undefined) note.rect = body.rect
            await writeNotes(root, moveMatch[1], notes)
            return json(res, 200, note)
          }

          const replyMatch = url.pathname.match(/^\/__bench\/api\/notes\/([a-z0-9-]+)\/reply$/)
          if (replyMatch && req.method === "POST") {
            const body = JSON.parse(await readBody(req))
            const notes = await readNotes(root, replyMatch[1])
            const note = notes.find((n) => n.id === body.id)
            if (!note) return json(res, 404, { error: "note not found" })
            note.replies = [
              ...(note.replies ?? []),
              {
                id: `reply_${randomUUID().slice(0, 8)}`,
                author: body.author ?? "human",
                text: body.text ?? "",
                created: new Date().toISOString(),
              },
            ]
            await writeNotes(root, replyMatch[1], notes)
            return json(res, 200, note)
          }

          const resolveMatch = url.pathname.match(/^\/__bench\/api\/notes\/([a-z0-9-]+)\/resolve$/)
          if (resolveMatch && req.method === "POST") {
            const body = JSON.parse(await readBody(req))
            const notes = await readNotes(root, resolveMatch[1])
            const note = notes.find((n) => n.id === body.id)
            if (!note) return json(res, 404, { error: "note not found" })
            note.status = "resolved"
            await writeNotes(root, resolveMatch[1], notes)
            return json(res, 200, note)
          }

          return json(res, 404, { error: "unknown bench endpoint" })
        } catch (err) {
          return json(res, 500, { error: String(err) })
        }
      })
    },
  }
}
