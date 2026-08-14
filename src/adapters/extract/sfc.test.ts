import { describe, expect, it } from "vitest"
import type { SourceFile } from "../../core/model"
import { svelteExtractor } from "./svelte"
import { vueExtractor } from "./vue"

// Every prop form here is taken from the frameworks' own documented syntax:
// Vue's type-only defineProps (inline, interface, withDefaults) and Svelte 5's
// annotated $props() destructuring. The point is that both reach the SAME
// classifier as TSX, so a knob behaves identically whatever the source was.

function file(path: string, source: string): SourceFile {
  return { path, source }
}

describe("vue extractor", () => {
  it("reads an inline type literal on defineProps", () => {
    const [spec] = vueExtractor.extract(
      file(
        "src/components/Button.vue",
        `<script setup lang="ts">
defineProps<{ label?: string; count?: number; disabled?: boolean }>()
</script>
<template><button>{{ label }}</button></template>`
      )
    )
    expect(spec?.name).toBe("Button")
    expect(spec?.slug).toBe("button")
    expect(spec?.props.map((p) => [p.name, p.kind])).toEqual([
      ["label", "string"],
      ["count", "number"],
      ["disabled", "boolean"],
    ])
  })

  it("resolves a local interface and keeps literal unions as enum knobs", () => {
    const [spec] = vueExtractor.extract(
      file(
        "src/components/Badge.vue",
        `<script setup lang="ts">
/** Small status label. */
interface Props {
  /** Visual weight. */
  variant?: "default" | "success" | "danger"
  size?: 1 | 2
}
defineProps<Props>()
</script>`
      )
    )
    expect(spec?.description).toBe("Small status label.")
    const variant = spec?.props.find((p) => p.name === "variant")
    expect(variant).toMatchObject({
      kind: "enum",
      options: ["default", "success", "danger"],
      description: "Visual weight.",
      optional: true,
    })
    expect(spec?.props.find((p) => p.name === "size")).toMatchObject({
      kind: "enum",
      numeric: true,
      options: ["1", "2"],
    })
  })

  it("reads props through withDefaults", () => {
    const [spec] = vueExtractor.extract(
      file(
        "src/components/Alert.vue",
        `<script setup lang="ts">
interface Props { tone?: "info" | "warn" }
const props = withDefaults(defineProps<Props>(), { tone: "info" })
</script>`
      )
    )
    expect(spec?.props.find((p) => p.name === "tone")?.options).toEqual(["info", "warn"])
  })

  it("prefers the setup block over a plain module script", () => {
    const [spec] = vueExtractor.extract(
      file(
        "src/components/Card.vue",
        `<script lang="ts">export const NAME = "card"</script>
<script setup lang="ts">defineProps<{ title?: string }>()</script>`
      )
    )
    expect(spec?.props.map((p) => p.name)).toEqual(["title"])
  })

  // Same stance as TSX without typecheck: say "no knob", never guess.
  it("degrades to unsupported for a type it cannot resolve locally", () => {
    const [spec] = vueExtractor.extract(
      file(
        "src/components/Imported.vue",
        `<script setup lang="ts">
import type { Props } from "./types"
defineProps<Props>()
</script>`
      )
    )
    expect(spec?.name).toBe("Imported")
    expect(spec?.props).toEqual([])
  })

  it("still registers a component with no script at all", () => {
    const [spec] = vueExtractor.extract(
      file("src/components/Static.vue", `<template><hr /></template>`)
    )
    expect(spec).toMatchObject({ name: "Static", slug: "static", props: [] })
  })

  it("ignores files whose name is not a component name", () => {
    expect(vueExtractor.extract(file("src/components/index.vue", `<template/>`))).toEqual([])
  })
})

describe("svelte extractor", () => {
  it("reads an inline type annotation on $props()", () => {
    const [spec] = svelteExtractor.extract(
      file(
        "src/components/Toggle.svelte",
        `<script lang="ts">
  let { label = "", on = false }: { label?: string; on?: boolean } = $props()
</script>
<button>{label}</button>`
      )
    )
    expect(spec?.name).toBe("Toggle")
    expect(spec?.props.map((p) => [p.name, p.kind])).toEqual([
      ["label", "string"],
      ["on", "boolean"],
    ])
  })

  it("resolves a local Props interface with JSDoc and unions", () => {
    const [spec] = svelteExtractor.extract(
      file(
        "src/components/Pill.svelte",
        `<script lang="ts">
  /** A rounded status pill. */
  interface Props {
    /** Colour role. */
    tone?: "neutral" | "danger"
    children?: unknown
  }
  let { tone = "neutral", children }: Props = $props()
</script>`
      )
    )
    expect(spec?.description).toBe("A rounded status pill.")
    expect(spec?.props.find((p) => p.name === "tone")).toMatchObject({
      kind: "enum",
      options: ["neutral", "danger"],
      description: "Colour role.",
    })
    // children is the composed-children knob, whatever the framework calls it
    expect(spec?.props.find((p) => p.name === "children")?.kind).toBe("children")
  })

  it("skips the module script and reads the instance one", () => {
    const [spec] = svelteExtractor.extract(
      file(
        "src/components/Row.svelte",
        `<script module lang="ts">export const KIND = "row"</script>
<script lang="ts">let { dense = false }: { dense?: boolean } = $props()</script>`
      )
    )
    expect(spec?.props.map((p) => p.name)).toEqual(["dense"])
  })

  it("registers a component that declares no props", () => {
    const [spec] = svelteExtractor.extract(
      file("src/components/Divider.svelte", `<hr />`)
    )
    expect(spec).toMatchObject({ name: "Divider", props: [] })
  })
})

describe("extractor ports", () => {
  it("claim their own extensions", () => {
    expect(vueExtractor.extensions).toEqual([".vue"])
    expect(svelteExtractor.extensions).toEqual([".svelte"])
  })
})
