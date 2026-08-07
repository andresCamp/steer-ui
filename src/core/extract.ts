import ts from "typescript"
import type { BenchComponentSpec, BenchProp } from "./model"

// TypeScript AST extraction: components and their prop knobs, derived from
// source text alone. Pure — same source in, same specs out.

export function classifyType(
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

function extractProps(members: ts.NodeArray<ts.TypeElement> | undefined): BenchProp[] {
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
export function extractComponents(
  filePath: string,
  source: string
): Omit<BenchComponentSpec, "usages">[] {
  const sf = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)

  const propsByName = new Map<string, ts.NodeArray<ts.TypeElement>>()
  const declared = new Map<string, string | undefined>() // every capitalized fn -> jsdoc
  const exported = new Set<string>()
  // Compound assignments: Card.Actions = CardActions (expando) or
  // const Card = Object.assign(CardRoot, { Actions: CardActions })
  const compounds: { name: string; base: string; target: string }[] = []
  // Object.assign bases: exported name -> root function name (for props/doc)
  const assignRoots = new Map<string, string>()

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
          // Object.assign idiom: const Card = Object.assign(CardRoot, { Actions: CardActions })
          if (
            decl.initializer &&
            ts.isCallExpression(decl.initializer) &&
            ts.isPropertyAccessExpression(decl.initializer.expression) &&
            ts.isIdentifier(decl.initializer.expression.expression) &&
            decl.initializer.expression.expression.text === "Object" &&
            decl.initializer.expression.name.text === "assign" &&
            decl.initializer.arguments.length >= 2
          ) {
            const [rootArg, ...memberArgs] = decl.initializer.arguments
            if (ts.isIdentifier(rootArg)) {
              assignRoots.set(decl.name.text, rootArg.text)
            }
            for (const memberArg of memberArgs) {
              if (!ts.isObjectLiteralExpression(memberArg)) continue
              for (const prop of memberArg.properties) {
                if (
                  ts.isPropertyAssignment(prop) &&
                  ts.isIdentifier(prop.name) &&
                  /^[A-Z]/.test(prop.name.text) &&
                  ts.isIdentifier(prop.initializer)
                ) {
                  compounds.push({
                    name: `${decl.name.text}.${prop.name.text}`,
                    base: decl.name.text,
                    target: prop.initializer.text,
                  })
                } else if (
                  ts.isShorthandPropertyAssignment(prop) &&
                  /^[A-Z]/.test(prop.name.text)
                ) {
                  compounds.push({
                    name: `${decl.name.text}.${prop.name.text}`,
                    base: decl.name.text,
                    target: prop.name.text,
                  })
                }
              }
            }
          }
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

  const components: Omit<BenchComponentSpec, "usages">[] = []
  // Compound targets are absorbed into their dotted entry rather than
  // listed twice (CardActions exists in the manifest only as Card.Actions).
  const compoundTargets = new Set(
    compounds.filter((c) => exported.has(c.base)).map((c) => c.target)
  )
  const rootTargets = new Set(assignRoots.values())
  for (const name of exported) {
    if (compoundTargets.has(name) || rootTargets.has(name)) continue
    // Object.assign bases take props/doc from their root function when
    // their own <Name>Props does not exist (CardRoot holds CardProps).
    const root = assignRoots.get(name)
    components.push({
      name,
      slug: name.toLowerCase(),
      file: filePath,
      description: declared.get(name) ?? (root ? declared.get(root) : undefined),
      props: extractProps(
        propsByName.get(`${name}Props`) ?? (root ? propsByName.get(`${root}Props`) : undefined)
      ),
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
      target: compound.target,
      props: extractProps(propsByName.get(`${compound.target}Props`)),
    })
  }
  return components
}
