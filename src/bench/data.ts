import type { Component } from "solid-js"

// --- shared types (mirror of tooling/bench-plugin.ts output) ---------------

export interface BenchProp {
  name: string
  kind: "enum" | "boolean" | "string" | "number" | "children" | "unsupported"
  options?: string[]
  optional: boolean
  description?: string
  raw: string
}

export interface BenchUsage {
  file: string
  line: number
  snippet: string
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
  components: BenchComponentSpec[]
}

export interface BenchFixture {
  states: Record<string, Record<string, string>>
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

const modules = import.meta.glob("../components/*.tsx", { eager: true }) as Record<
  string,
  Record<string, Component<Record<string, unknown>>>
>

export const registry: Record<string, Component<Record<string, unknown>>> = {}
for (const [file, mod] of Object.entries(modules)) {
  const name = file.split("/").pop()!.replace(".tsx", "")
  const component = mod[name] ?? mod.default
  if (component) registry[name] = component
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
      case "string":
      case "children":
        props[prop.name] = value
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
