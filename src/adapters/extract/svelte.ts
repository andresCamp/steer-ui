import ts from "typescript"
import type { Extractor } from "../../ports"
import { sfcExtract, type ScriptBlock, type SfcReader } from "./sfc"

// Svelte 5 declares props by annotating the $props() destructuring:
// `let { a, b }: Props = $props()` or `let { a }: { a: string } = $props()`.
// The type annotation sits on the variable declaration, not on the call.

const reader: SfcReader = {
  id: "svelte",
  extensions: [".svelte"],

  // <script module> is module-level code; instance props live in the plain one.
  pickScript(blocks: ScriptBlock[]) {
    return blocks.find((b) => !/\bmodule\b/.test(b.attrs) && !/\bcontext=/.test(b.attrs)) ?? blocks[0]
  },

  locateProps(sf: ts.SourceFile) {
    let type: ts.TypeNode | undefined
    const walk = (node: ts.Node): void => {
      if (
        !type &&
        ts.isVariableDeclaration(node) &&
        node.initializer &&
        ts.isCallExpression(node.initializer) &&
        ts.isIdentifier(node.initializer.expression) &&
        node.initializer.expression.text === "$props"
      ) {
        type = node.type
      }
      ts.forEachChild(node, walk)
    }
    walk(sf)
    return type
  },
}

export const svelteExtractor: Extractor = {
  id: reader.id,
  extensions: reader.extensions,
  extract: (file) => sfcExtract(reader, file),
}
