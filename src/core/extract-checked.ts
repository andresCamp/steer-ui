import ts from "typescript"
import type { BenchComponentSpec, BenchProp, SourceFile } from "./model"

// Checked extraction: upgrades prop classification with the TypeScript type
// checker so imported, aliased, and intersection Props types produce real
// knobs instead of "unsupported". Still pure: the program is built over an
// in-memory host from the provided source text, nothing touches disk. The
// syntactic pass (extract.ts) remains the structural authority (which
// components exist, compounds, JSDoc on functions); this pass only replaces
// each spec's prop list when the checker can resolve its Props type.

const COMPILER_OPTIONS: ts.CompilerOptions = {
  target: ts.ScriptTarget.Latest,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  jsx: ts.JsxEmit.Preserve,
  // strict:false keeps optional props from unioning with undefined; noLib
  // keeps the virtual program self-contained (intrinsics still classify).
  strict: false,
  noLib: true,
  skipLibCheck: true,
  allowImportingTsExtensions: true,
}

function createVirtualProgram(files: SourceFile[]): ts.Program {
  const fileMap = new Map(files.map((f) => [f.path, f.source]))
  const host: ts.CompilerHost = {
    getSourceFile: (name) => {
      const source = fileMap.get(name)
      if (source === undefined) return undefined
      return ts.createSourceFile(name, source, ts.ScriptTarget.Latest, true)
    },
    fileExists: (name) => fileMap.has(name),
    readFile: (name) => fileMap.get(name),
    writeFile: () => {},
    getDefaultLibFileName: () => "lib.d.ts",
    getCurrentDirectory: () => "",
    getCanonicalFileName: (name) => name,
    useCaseSensitiveFileNames: () => true,
    getNewLine: () => "\n",
  }
  return ts.createProgram([...fileMap.keys()], COMPILER_OPTIONS, host)
}

function classifyCheckedType(
  checker: ts.TypeChecker,
  type: ts.Type
): Pick<BenchProp, "kind" | "options" | "numeric" | "raw"> {
  const raw = checker.typeToString(type)
  if (type.flags & ts.TypeFlags.BooleanLike) return { kind: "boolean", raw }
  if (type.flags & ts.TypeFlags.StringLiteral) {
    return { kind: "enum", options: [(type as ts.StringLiteralType).value], raw }
  }
  if (type.flags & ts.TypeFlags.String) return { kind: "string", raw }
  if (type.flags & ts.TypeFlags.Number) return { kind: "number", raw }
  if (type.isUnion()) {
    const members = type.types.filter(
      (t) => !(t.flags & (ts.TypeFlags.Undefined | ts.TypeFlags.Null))
    )
    // boolean widens to the true|false union inside larger unions too
    if (members.length > 0 && members.every((t) => t.flags & ts.TypeFlags.BooleanLike)) {
      return { kind: "boolean", raw }
    }
    if (members.length > 0 && members.every((t) => t.isStringLiteral())) {
      return { kind: "enum", options: members.map((t) => (t as ts.StringLiteralType).value), raw }
    }
    if (members.length > 0 && members.every((t) => t.isNumberLiteral())) {
      return {
        kind: "enum",
        options: members.map((t) => String((t as ts.NumberLiteralType).value)),
        numeric: true,
        raw,
      }
    }
  }
  return { kind: "unsupported", raw }
}

function propsFromType(checker: ts.TypeChecker, type: ts.Type): BenchProp[] {
  const props: BenchProp[] = []
  for (const symbol of checker.getPropertiesOfType(type)) {
    const name = symbol.getName()
    const declaration = symbol.valueDeclaration ?? symbol.declarations?.[0]
    const propType = declaration
      ? checker.getTypeOfSymbolAtLocation(symbol, declaration)
      : checker.getDeclaredTypeOfSymbol(symbol)
    const optional = (symbol.flags & ts.SymbolFlags.Optional) !== 0
    const description =
      ts.displayPartsToString(symbol.getDocumentationComment(checker)) || undefined
    if (name === "children") {
      props.push({
        name,
        kind: "children",
        optional,
        description,
        raw: checker.typeToString(propType),
      })
      continue
    }
    props.push({ name, optional, description, ...classifyCheckedType(checker, propType) })
  }
  return props
}

/**
 * Resolve `<typeName>` in `file` through the checker: a local interface or
 * alias, an imported name, an alias of an intersection, anything the checker
 * can see. Returns undefined when the name does not resolve to a type.
 */
function resolveNamedType(
  checker: ts.TypeChecker,
  file: ts.SourceFile,
  typeName: string
): ts.Type | undefined {
  let found: ts.Type | undefined
  const visit = (node: ts.Node) => {
    if (found) return
    if (
      (ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) &&
      node.name.text === typeName
    ) {
      found = checker.getTypeAtLocation(node.name)
      return
    }
    // An import's LOCAL binding is node.name (`import { A as BProps }`
    // binds BProps); that is the name the convention matches against.
    if (ts.isImportSpecifier(node) && node.name.text === typeName) {
      found = checker.getTypeAtLocation(node.name)
      return
    }
    ts.forEachChild(node, visit)
  }
  visit(file)
  return found
}

/**
 * Upgrade each spec's props via the checker. `specs` come from the syntactic
 * pass; `files` must include every source the Props types can reach
 * (component files plus the rest of the scanned tree). Specs whose Props
 * type the checker cannot resolve keep their syntactic props (invariant 4:
 * degrade, never fail the manifest).
 */
export function upgradePropsChecked<S extends Omit<BenchComponentSpec, "usages">>(
  specs: S[],
  files: SourceFile[]
): S[] {
  const program = createVirtualProgram(files)
  const checker = program.getTypeChecker()
  return specs.map((spec) => {
    const file = program.getSourceFile(spec.file)
    if (!file) return spec
    const fnName = spec.target ?? (spec.name.includes(".") ? undefined : spec.name)
    if (!fnName) return spec
    const type = resolveNamedType(checker, file, `${fnName}Props`)
    if (!type) return spec
    const props = propsFromType(checker, type)
    return { ...spec, props }
  })
}
