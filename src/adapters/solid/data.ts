import { createComponent, type Component, type JSX } from "solid-js"
import type {
  BenchComponentSpec,
  BenchFixture,
  BenchManifest,
  BenchNote,
  ComponentRef,
  DoctorReport,
  FixtureValue,
} from "../../core/model"
import { coerceProps as coercePropsCore } from "../../core/state-url"

// Solid render surface glue: the component registry, fixture-ref rendering,
// and the HTTP client for the bench API. The pure contract (types, URL
// grammar, coercion) lives in core; this file only binds it to Solid.

export type {
  BenchComponentSpec,
  BenchFixture,
  BenchManifest,
  BenchNote,
  BenchProp,
  BenchReply,
  BenchUsage,
  ComponentRef,
  DoctorReport,
  FixtureValue,
} from "../../core/model"
export {
  sameState,
  stateKey,
  stateUrl,
  parseStateUrl,
  stringifyFixtureValues,
} from "../../core/state-url"

// --- component registry, provided by the host -------------------------------
// The host owns the glob (import.meta.glob is resolved relative to the
// calling file), so registration is a call the host makes at startup:
//
//   registerComponents(import.meta.glob("./components/**/*.tsx", { eager: true }))
//
// Registers EVERY exported capitalized component per module, so nested
// folders and subcomponent files all resolve.

export const registry: Record<string, Component<Record<string, unknown>>> = {}

/** The author identity attached to notes written from this bench UI. */
export let benchAuthor = "human"

export function registerComponents(
  modules: Record<string, Record<string, unknown>>,
  options: { author?: string } = {}
): void {
  if (options.author) benchAuthor = options.author
  for (const mod of Object.values(modules)) {
    for (const [exportName, value] of Object.entries(mod)) {
      if (typeof value === "function" && /^[A-Z]/.test(exportName)) {
        registry[exportName] = value as Component<Record<string, unknown>>
      }
    }
  }
  // Compound components: capitalized function properties attached to an
  // export (Card.Actions) register under their dotted name. Note: in dev,
  // solid-refresh wraps exports, so expando properties may be invisible
  // here; resolveComponent carries the fallbacks.
  for (const [name, component] of Object.entries({ ...registry })) {
    for (const key of Object.getOwnPropertyNames(component)) {
      const member = (component as unknown as Record<string, unknown>)[key]
      if (/^[A-Z]/.test(key) && typeof member === "function") {
        registry[`${name}.${key}`] = member as Component<Record<string, unknown>>
      }
    }
  }
}

/**
 * Resolve a manifest name to a renderable component. Dotted compound names
 * fall back to property access on the base, then to the BaseSub naming
 * convention (Card.Actions -> CardActions), which survives dev-mode HMR
 * wrappers that hide expando properties.
 */
export function resolveComponent(
  name: string,
  target?: string
): Component<Record<string, unknown>> | undefined {
  if (registry[name]) return registry[name]
  if (target && registry[target]) return registry[target]
  if (!name.includes(".")) return undefined
  const [base, sub] = name.split(".")
  const viaProperty = (registry[base] as unknown as Record<string, unknown> | undefined)?.[sub]
  if (typeof viaProperty === "function") {
    return viaProperty as Component<Record<string, unknown>>
  }
  return registry[`${base}${sub}`]
}

// --- api client ------------------------------------------------------------

export const fetchManifest = (): Promise<BenchManifest> =>
  fetch("/__bench/api/manifest").then((r) => r.json())

export const fetchFixture = (slug: string): Promise<BenchFixture> =>
  fetch(`/__bench/api/fixtures/${slug}`).then((r) => r.json())

export const fetchNotes = (slug: string): Promise<BenchNote[]> =>
  fetch(`/__bench/api/notes/${slug}`).then((r) => r.json())

export const fetchDoctor = (): Promise<DoctorReport> =>
  fetch("/__bench/api/doctor").then((r) => r.json())

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

// --- fixture-ref rendering -------------------------------------------------

/** Render a fixture component reference against the registry. */
function renderRef(ref: ComponentRef): JSX.Element | string {
  const component = resolveComponent(ref.$component)
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

/** Core coercion bound to this registry's children renderer. */
export function coerceProps(
  spec: BenchComponentSpec,
  values: Record<string, string | undefined>
): Record<string, unknown> {
  return coercePropsCore(spec, values, (value) => resolveFixtureValue(value))
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
