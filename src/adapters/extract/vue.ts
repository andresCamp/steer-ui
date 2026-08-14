import ts from "typescript"
import type { Extractor } from "../../ports"
import { sfcExtract, type ScriptBlock, type SfcReader } from "./sfc"

// Vue 3 declares props with a type argument: `defineProps<{...}>()`,
// `defineProps<Props>()`, or wrapped in `withDefaults(defineProps<Props>(), ...)`.
// All three are the same AST shape once you find the defineProps call.

const reader: SfcReader = {
  id: "vue",
  extensions: [".vue"],

  // Props live in <script setup>. A plain <script> block alongside it holds
  // module-level code, not props, so prefer setup when both are present.
  pickScript(blocks: ScriptBlock[]) {
    return blocks.find((b) => /\bsetup\b/.test(b.attrs)) ?? blocks[0]
  },

  locateProps(sf: ts.SourceFile) {
    let type: ts.TypeNode | undefined
    const walk = (node: ts.Node): void => {
      if (
        !type &&
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === "defineProps"
      ) {
        type = node.typeArguments?.[0]
      }
      ts.forEachChild(node, walk)
    }
    walk(sf)
    return type
  },
}

export const vueExtractor: Extractor = {
  id: reader.id,
  extensions: reader.extensions,
  extract: (file) => sfcExtract(reader, file),
}
