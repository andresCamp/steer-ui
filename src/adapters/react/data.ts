import { createElement, type ComponentType, type ReactNode } from "react"
import type { SteerComponentSpec, ComponentRef, FixtureValue } from "../../core/model"
import { coerceProps as coercePropsCore } from "../../core/state-url"

// React render surface glue: the component registry, fixture-ref rendering,
// and re-exports of the shared client. The pure contract (types, URL
// grammar, coercion) lives in core; this file only binds it to React.

export type {
  SteerComponentSpec,
  SteerFixture,
  SteerManifest,
  SteerNote,
  SteerProp,
  SteerReply,
  SteerUsage,
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
export {
  fetchDoctor,
  fetchFixture,
  fetchManifest,
  fetchNotes,
  moveNote,
  postNote,
  replyNote,
  resolveNote,
  selectorWithin,
} from "../client"

// --- component registry, provided by the host -------------------------------
// The host owns the glob (import.meta.glob is resolved relative to the
// calling file), so registration is a call the host makes at startup:
//
//   registerComponents(import.meta.glob("./components/**/*.tsx", { eager: true }))

export const registry: Record<string, ComponentType<Record<string, unknown>>> = {}

/** The author identity attached to notes written from this steer UI. */
export let steerAuthor = "human"

export function registerComponents(
  modules: Record<string, Record<string, unknown>>,
  options: { author?: string } = {}
): void {
  if (options.author) steerAuthor = options.author
  for (const mod of Object.values(modules)) {
    for (const [exportName, value] of Object.entries(mod)) {
      if (typeof value === "function" && /^[A-Z]/.test(exportName)) {
        registry[exportName] = value as ComponentType<Record<string, unknown>>
      }
    }
  }
  // Compound components register under their dotted name. Fast refresh does
  // not proxy exports the way solid-refresh does, but resolveComponent keeps
  // the same fallback chain so both surfaces behave identically.
  for (const [name, component] of Object.entries({ ...registry })) {
    for (const key of Object.getOwnPropertyNames(component)) {
      const member = (component as unknown as Record<string, unknown>)[key]
      if (/^[A-Z]/.test(key) && typeof member === "function") {
        registry[`${name}.${key}`] = member as ComponentType<Record<string, unknown>>
      }
    }
  }
}

/**
 * Resolve a manifest name to a renderable component. Dotted compound names
 * fall back to property access on the base, then to the BaseSub naming
 * convention (Card.Actions -> CardActions).
 */
export function resolveComponent(
  name: string,
  target?: string
): ComponentType<Record<string, unknown>> | undefined {
  if (registry[name]) return registry[name]
  if (target && registry[target]) return registry[target]
  if (!name.includes(".")) return undefined
  const [base, sub] = name.split(".")
  const viaProperty = (registry[base] as unknown as Record<string, unknown> | undefined)?.[sub]
  if (typeof viaProperty === "function") {
    return viaProperty as ComponentType<Record<string, unknown>>
  }
  return registry[`${base}${sub}`]
}

// --- fixture-ref rendering -------------------------------------------------

/** Render a fixture component reference against the registry. */
function renderRef(ref: ComponentRef): ReactNode {
  const component = resolveComponent(ref.$component)
  if (!component) return `[unknown component: ${ref.$component}]`
  const props: Record<string, unknown> = { ...(ref.props ?? {}) }
  if (ref.children !== undefined) props.children = resolveFixtureValue(ref.children)
  return createElement(component, props)
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
  spec: SteerComponentSpec,
  values: Record<string, string | undefined>
): Record<string, unknown> {
  return coercePropsCore(spec, values, (value) => resolveFixtureValue(value))
}
