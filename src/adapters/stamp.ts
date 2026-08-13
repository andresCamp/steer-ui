import ts from "typescript"
import { STEER_COMPONENT_ATTR, STEER_PROPS_ATTR } from "./stamp-attr"

export { STEER_COMPONENT_ATTR, STEER_PROPS_ATTR, slugFromComponentName } from "./stamp-attr"

// Serve-only JSX stamp. Adds data-steer-component and data-steer-props so a
// live-app click can file the note under the right bench slug. Never runs
// in vite build (the plugin is apply: "serve").

const SKIP = new Set([
  "For",
  "Show",
  "Suspense",
  "ErrorBoundary",
  "Dynamic",
  "A",
  "Router",
  "Route",
  "Index",
  "Match",
  "Switch",
  "Portal",
  "StrictMode",
])

function jsxTagName(tag: ts.JsxTagNameExpression, allowed?: Set<string>): string | undefined {
  if (ts.isIdentifier(tag) && /^[A-Z]/.test(tag.text) && !SKIP.has(tag.text)) {
    if (allowed && !allowed.has(tag.text)) return undefined
    return tag.text
  }
  if (
    ts.isPropertyAccessExpression(tag) &&
    ts.isIdentifier(tag.expression) &&
    ts.isIdentifier(tag.name) &&
    /^[A-Z]/.test(tag.expression.text)
  ) {
    const name = `${tag.expression.text}.${tag.name.text}`
    if (allowed && !allowed.has(name)) return undefined
    return name
  }
  return undefined
}

function attrName(attr: ts.JsxAttribute): string {
  return ts.isIdentifier(attr.name) ? attr.name.text : attr.name.getText()
}

function hasAttr(attrs: ts.JsxAttributes, name: string): boolean {
  return attrs.properties.some((p) => ts.isJsxAttribute(p) && attrName(p) === name)
}

function staticPropValue(init: ts.JsxAttributeValue | undefined): string | undefined {
  if (!init) return "true"
  if (ts.isStringLiteral(init) || ts.isNoSubstitutionTemplateLiteral(init)) return init.text
  if (!ts.isJsxExpression(init) || !init.expression) return undefined
  const e = init.expression
  if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) return e.text
  if (e.kind === ts.SyntaxKind.TrueKeyword) return "true"
  if (e.kind === ts.SyntaxKind.FalseKeyword) return "false"
  if (ts.isNumericLiteral(e)) return e.text
  return undefined
}

function staticProps(attrs: ts.JsxAttributes): Record<string, string> {
  const out: Record<string, string> = {}
  for (const p of attrs.properties) {
    if (!ts.isJsxAttribute(p)) continue
    const key = attrName(p)
    if (key.startsWith("data-") || key === "class" || key === "className" || key === "style") continue
    const value = staticPropValue(p.initializer)
    if (value !== undefined) out[key] = value
  }
  return out
}

function stringAttr(name: string, value: string): ts.JsxAttribute {
  return ts.factory.createJsxAttribute(
    ts.factory.createIdentifier(name),
    ts.factory.createStringLiteral(value),
  )
}

function wrap(node: ts.JsxElement | ts.JsxSelfClosingElement, name: string): ts.JsxElement {
  const attrs = ts.isJsxElement(node) ? node.openingElement.attributes : node.attributes
  const props = staticProps(attrs)
  const stamped: ts.JsxAttribute[] = [stringAttr(STEER_COMPONENT_ATTR, name)]
  if (Object.keys(props).length > 0) stamped.push(stringAttr(STEER_PROPS_ATTR, JSON.stringify(props)))
  stamped.push(
    ts.factory.createJsxAttribute(
      ts.factory.createIdentifier("style"),
      ts.factory.createJsxExpression(
        undefined,
        ts.factory.createObjectLiteralExpression([
          ts.factory.createPropertyAssignment(
            ts.factory.createIdentifier("display"),
            ts.factory.createStringLiteral("contents"),
          ),
        ]),
      ),
    ),
  )
  return ts.factory.createJsxElement(
    ts.factory.createJsxOpeningElement(
      ts.factory.createIdentifier("span"),
      undefined,
      ts.factory.createJsxAttributes(stamped),
    ),
    [node],
    ts.factory.createJsxClosingElement(ts.factory.createIdentifier("span")),
  )
}

function isStampSpan(node: ts.Node): boolean {
  return (
    ts.isJsxElement(node) &&
    ts.isIdentifier(node.openingElement.tagName) &&
    node.openingElement.tagName.text === "span" &&
    hasAttr(node.openingElement.attributes, STEER_COMPONENT_ATTR)
  )
}

/** Stamp host-component JSX. Returns undefined when the file needs no change. */
export function stampComponents(
  source: string,
  fileName: string,
  allowed?: Set<string>,
): string | undefined {
  const sf = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  let changed = false

  const transformer: ts.TransformerFactory<ts.SourceFile> = (context) => {
    const visit = (node: ts.Node): ts.Node => {
      const visited = ts.visitEachChild(node, visit, context)
      if (isStampSpan(visited)) return visited
      if (ts.isJsxElement(visited)) {
        const name = jsxTagName(visited.openingElement.tagName, allowed)
        if (name) {
          changed = true
          return wrap(visited, name)
        }
      }
      if (ts.isJsxSelfClosingElement(visited)) {
        const name = jsxTagName(visited.tagName, allowed)
        if (name) {
          changed = true
          return wrap(visited, name)
        }
      }
      return visited
    }
    return (node) => ts.visitNode(node, visit) as ts.SourceFile
  }

  const result = ts.transform(sf, [transformer])
  const stamped = result.transformed[0]
  result.dispose()
  if (!changed) return undefined
  return ts.createPrinter({ newLine: ts.NewLineKind.LineFeed }).printFile(stamped)
}
