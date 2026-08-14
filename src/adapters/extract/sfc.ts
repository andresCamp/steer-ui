import ts from "typescript"
import type { SteerComponentSpec, SteerProp, SourceFile } from "../../core/model"
import { extractProps, jsDocText } from "../../core/extract"

// Vue and Svelte both declare props as a TypeScript annotation inside a <script>
// block: `defineProps<Props>()` and `let { ... }: Props = $props()`. So neither
// needs its framework's compiler. Pull the script, parse it with the TypeScript
// API we already depend on, and reuse the same prop classifier as TSX, which
// keeps knobs, JSDoc and graceful degradation identical across every language
// surface.
//
// The limit is the same one TSX has without `typecheck`: a Props type imported
// from another module cannot be resolved from one file, so it degrades to
// `unsupported` rather than guessing.

const SCRIPT = /<script\b([^>]*)>([\s\S]*?)<\/script>/g

export interface ScriptBlock {
  attrs: string
  source: string
}

/** Every <script> block in an SFC, in source order. */
export function scriptBlocks(source: string): ScriptBlock[] {
  const blocks: ScriptBlock[] = []
  for (const match of source.matchAll(SCRIPT)) {
    blocks.push({ attrs: match[1] ?? "", source: match[2] ?? "" })
  }
  return blocks
}

/** Component name from the file name: the SFC convention, no export to read. */
export function componentNameFromPath(filePath: string): string | undefined {
  const base = filePath.split("/").pop() ?? filePath
  const name = base.replace(/\.(vue|svelte)$/, "")
  return /^[A-Z][A-Za-z0-9_]*$/.test(name) ? name : undefined
}

function parse(filePath: string, script: string): ts.SourceFile {
  return ts.createSourceFile(filePath, script, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
}

/** Walk every node, since props declarations are nested inside statements. */
function visit(node: ts.Node, fn: (n: ts.Node) => void): void {
  fn(node)
  ts.forEachChild(node, (child) => visit(child, fn))
}

/**
 * Resolve a props TypeNode to its members. Inline type literals are used
 * directly; a reference to a local interface or type alias is looked up in the
 * same script. Anything else (an import, a mapped type) is left unresolved so
 * the caller can degrade visibly.
 */
function membersOf(
  sf: ts.SourceFile,
  type: ts.TypeNode | undefined
): { members?: ts.NodeArray<ts.TypeElement>; description?: string } {
  if (!type) return {}
  if (ts.isTypeLiteralNode(type)) return { members: type.members }
  if (!ts.isTypeReferenceNode(type)) return {}
  const wanted = type.typeName.getText()
  let found: { members?: ts.NodeArray<ts.TypeElement>; description?: string } = {}
  visit(sf, (node) => {
    if (ts.isInterfaceDeclaration(node) && node.name.text === wanted) {
      found = { members: node.members, description: jsDocText(node) }
    } else if (
      ts.isTypeAliasDeclaration(node) &&
      node.name.text === wanted &&
      ts.isTypeLiteralNode(node.type)
    ) {
      found = { members: node.type.members, description: jsDocText(node) }
    }
  })
  return found
}

export interface SfcReader {
  id: string
  extensions: string[]
  /** Pick the script block that declares props. */
  pickScript(blocks: ScriptBlock[]): ScriptBlock | undefined
  /** Find the props type annotation within that script. */
  locateProps(sf: ts.SourceFile): ts.TypeNode | undefined
}

/** Turn an SFC reader into an Extractor. One component per file, named for it. */
export function sfcExtract(
  reader: SfcReader,
  file: SourceFile
): Omit<SteerComponentSpec, "usages">[] {
  const name = componentNameFromPath(file.path)
  if (!name) return []

  const block = reader.pickScript(scriptBlocks(file.source))
  let props: SteerProp[] = []
  let description: string | undefined

  if (block) {
    const sf = parse(file.path, block.source)
    const resolved = membersOf(sf, reader.locateProps(sf))
    props = extractProps(resolved.members)
    description = resolved.description
  }

  // A component with no script, or none we can read, is still a component: it
  // gets an address and renders, just without knobs. Degrade visibly.
  return [
    {
      name,
      slug: name.toLowerCase(),
      file: file.path,
      ...(description ? { description } : {}),
      props,
    },
  ]
}
