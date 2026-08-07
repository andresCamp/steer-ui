import { createComponent, type Component, type JSX } from "solid-js"

// --- shared types (mirror of tooling/bench-plugin.ts output) ---------------

export interface BenchProp {
  name: string
  kind: "enum" | "boolean" | "string" | "number" | "children" | "unsupported"
  options?: string[]
  numeric?: boolean
  optional: boolean
  description?: string
  raw: string
}

export interface BenchUsage {
  file: string
  line: number
  snippet: string
  internal?: boolean
}

export interface BenchComponentSpec {
  name: string
  slug: string
  file: string
  description?: string
  props: BenchProp[]
  usages: BenchUsage[]
}

export interface BenchManifest {
  generatedAt: string
  root: string
  warnings?: string[]
  components: BenchComponentSpec[]
}

/**
 * Fixture values are strings, or component references for composition:
 * { "$component": "Button", "props": {...}, "children": "..." }.
 * References serialize to JSON strings in the state URL, so every composed
 * state is still addressable.
 */
export type FixtureValue = string | ComponentRef
export interface ComponentRef {
  $component: string
  props?: Record<string, unknown>
  children?: FixtureValue
}

export interface BenchFixture {
  states: Record<string, Record<string, FixtureValue>>
}

export interface BenchReply {
  id: string
  author: string
  text: string
  created: string
}

export interface BenchNote {
  id: string
  component: string
  stateUrl: string
  selector: string
  coords: { x: number; y: number }
  /** Optional highlighted region (stage-relative fractions, may exceed 0..1) */
  rect?: { x: number; y: number; w: number; h: number }
  text: string
  author: string
  status: "open" | "resolved"
  created: string
  replies?: BenchReply[]
}

// --- component registry, derived from the filesystem via glob --------------
// Recursive, and registers EVERY exported capitalized component per module,
// so nested folders and subcomponent files all resolve.

const modules = import.meta.glob("../components/**/*.tsx", { eager: true }) as Record<
  string,
  Record<string, unknown>
>

export const registry: Record<string, Component<Record<string, unknown>>> = {}
for (const mod of Object.values(modules)) {
  for (const [exportName, value] of Object.entries(mod)) {
    if (typeof value === "function" && /^[A-Z]/.test(exportName)) {
      registry[exportName] = value as Component<Record<string, unknown>>
    }
  }
}

// --- api client ------------------------------------------------------------

export const fetchManifest = (): Promise<BenchManifest> =>
  fetch("/__bench/api/manifest").then((r) => r.json())

export const fetchFixture = (slug: string): Promise<BenchFixture> =>
  fetch(`/__bench/api/fixtures/${slug}`).then((r) => r.json())

export const fetchNotes = (slug: string): Promise<BenchNote[]> =>
  fetch(`/__bench/api/notes/${slug}`).then((r) => r.json())

export const postNote = (
  slug: string,
  note: Pick<BenchNote, "stateUrl" | "selector" | "coords" | "rect" | "text" | "author">
): Promise<BenchNote> =>
  fetch(`/__bench/api/notes/${slug}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(note),
  }).then((r) => r.json())

export const moveNote = (
  slug: string,
  id: string,
  coords: { x: number; y: number },
  rect?: { x: number; y: number; w: number; h: number }
): Promise<BenchNote> =>
  fetch(`/__bench/api/notes/${slug}/move`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, coords, rect }),
  }).then((r) => r.json())

export const replyNote = (
  slug: string,
  id: string,
  text: string,
  author: string
): Promise<BenchNote> =>
  fetch(`/__bench/api/notes/${slug}/reply`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, text, author }),
  }).then((r) => r.json())

export const resolveNote = (slug: string, id: string): Promise<BenchNote> =>
  fetch(`/__bench/api/notes/${slug}/resolve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  }).then((r) => r.json())

// --- prop coercion ---------------------------------------------------------

/** Render a fixture component reference against the registry. */
function renderRef(ref: ComponentRef): JSX.Element | string {
  const component = registry[ref.$component]
  if (!component) return `[unknown component: ${ref.$component}]`
  const props: Record<string, unknown> = { ...(ref.props ?? {}) }
  if (ref.children !== undefined) props.children = resolveFixtureValue(ref.children)
  return createComponent(component, props)
}

/**
 * A children value is a plain string, or a JSON component reference
 * ({"$component": ...}) — from a fixture object or serialized in the URL.
 */
export function resolveFixtureValue(value: FixtureValue): unknown {
  if (typeof value === "string") {
    if (value.startsWith("{")) {
      try {
        const parsed = JSON.parse(value)
        if (parsed && typeof parsed === "object" && "$component" in parsed) {
          return renderRef(parsed as ComponentRef)
        }
      } catch {
        // not JSON: fall through to the plain string
      }
    }
    return value
  }
  return renderRef(value)
}

/** Fixture values → knob strings (refs become JSON, staying URL-safe). */
export function stringifyFixtureValues(
  values: Record<string, FixtureValue>
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(values)) {
    out[key] = typeof value === "string" ? value : JSON.stringify(value)
  }
  return out
}

/** Turn URL search params (all strings) into typed props per the manifest. */
export function coerceProps(
  spec: BenchComponentSpec,
  values: Record<string, string | undefined>
): Record<string, unknown> {
  const props: Record<string, unknown> = {}
  for (const prop of spec.props) {
    const value = values[prop.name]
    if (value === undefined || value === "") continue
    switch (prop.kind) {
      case "boolean":
        props[prop.name] = value === "true"
        break
      case "number":
        props[prop.name] = Number(value)
        break
      case "enum":
        props[prop.name] = prop.numeric ? Number(value) : value
        break
      case "string":
        props[prop.name] = value
        break
      case "children":
        props[prop.name] = resolveFixtureValue(value)
        break
    }
  }
  return props
}

/** Serialize the current knob values into a shareable bench URL. */
export function stateUrl(slug: string, values: Record<string, string>): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(values)) {
    if (value !== "" && value !== undefined) params.set(key, value)
  }
  const query = params.toString()
  return `/__bench/${slug}${query ? `?${query}` : ""}`
}

/** Build a CSS selector for an element, scoped to the bench stage. */
export function selectorWithin(stage: HTMLElement, target: HTMLElement): string {
  const parts: string[] = []
  let el: HTMLElement | null = target
  while (el && el !== stage) {
    const tag = el.tagName.toLowerCase()
    const parent: HTMLElement | null = el.parentElement
    let part = tag
    if (parent) {
      const siblings = Array.from(parent.children).filter(
        (c) => c.tagName === el!.tagName
      )
      if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(el) + 1})`
    }
    parts.unshift(part)
    el = parent
  }
  return parts.join(" > ") || "(stage)"
}
