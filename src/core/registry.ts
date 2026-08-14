import type { ComponentRef, FixtureValue, SteerComponentSpec } from "./model"
import { coerceProps as coercePropsCore } from "./state-url"

// The component registry and the compound-name resolution chain, framework
// free. This was duplicated verbatim in the Solid and React surfaces, differing
// only in a type alias; the prebuilt chrome needs it and must not import a
// framework, so it belongs here. The surfaces keep their public API and bind
// their framework's element() on top.
//
// The host owns the glob (import.meta.glob resolves relative to the calling
// file), so registration is a call the host makes at startup with every
// exported capitalized component per module. Nested folders and subcomponent
// files therefore resolve without any per-component registration.

export const registry: Record<string, unknown> = {}

/** The author identity attached to notes written from this steer UI. */
export let steerAuthor = "human"

/** What the bench calls the place its home link goes back to. */
export let steerAppLabel = "app"

/** SFC convention: one component per file, named after the file, exported as
 *  default. Nothing else in the module is a component. */
function sfcName(path: string): string | undefined {
  const base = path.split("/").pop() ?? path
  const name = base.replace(/\.(vue|svelte)$/, "")
  return /^[A-Z][A-Za-z0-9_]*$/.test(name) ? name : undefined
}

export function registerComponents(
  modules: Record<string, Record<string, unknown>>,
  options: { author?: string; appLabel?: string } = {}
): void {
  if (options.author) steerAuthor = options.author
  if (options.appLabel) steerAppLabel = options.appLabel
  for (const [path, mod] of Object.entries(modules)) {
    // A Vue or Svelte SFC compiles to a default export that is an OBJECT, not
    // a capitalized function, so the TSX rules below would silently skip it and
    // the bench would list the component with nothing to render. The manifest
    // names SFCs after their file, so the registry has to agree.
    const fromFile = sfcName(path)
    if (fromFile && mod.default) {
      registry[fromFile] = mod.default
      continue
    }
    for (const [exportName, value] of Object.entries(mod)) {
      if (typeof value === "function" && /^[A-Z]/.test(exportName)) {
        registry[exportName] = value
      }
    }
  }
  // Compound components: capitalized function properties attached to an export
  // (Card.Actions) register under their dotted name. In dev, solid-refresh
  // wraps exports and these expando properties can be invisible here, which is
  // why resolveComponent carries fallbacks. Do not simplify that chain.
  for (const [name, component] of Object.entries({ ...registry })) {
    for (const key of Object.getOwnPropertyNames(component)) {
      const member = (component as Record<string, unknown>)[key]
      if (/^[A-Z]/.test(key) && typeof member === "function") {
        registry[`${name}.${key}`] = member
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
export function resolveComponent(name: string, target?: string): unknown {
  if (registry[name]) return registry[name]
  if (target && registry[target]) return registry[target]
  if (!name.includes(".")) return undefined
  const [base, sub] = name.split(".")
  if (!base || !sub) return undefined
  const viaProperty = (registry[base] as Record<string, unknown> | undefined)?.[sub]
  if (typeof viaProperty === "function") return viaProperty
  return registry[`${base}${sub}`]
}

/** Test seam: the registry is module state, so suites must be able to reset it. */
export function clearRegistry(): void {
  for (const key of Object.keys(registry)) delete registry[key]
  steerAuthor = "human"
  steerAppLabel = "app"
}

// --- fixture-ref rendering --------------------------------------------------
// A children value is a plain string, or a JSON component reference
// ({"$component": ...}) from a fixture object or serialized in a state URL.
// Building the instance is the one framework-aware step, so it arrives as
// Mounter.element rather than being imported.

type ElementFactory = (Component: unknown, props: Record<string, unknown>) => unknown

function renderRef(ref: ComponentRef, element: ElementFactory): unknown {
  const component = resolveComponent(ref.$component)
  if (!component) return `[unknown component: ${ref.$component}]`
  const props: Record<string, unknown> = { ...(ref.props ?? {}) }
  if (ref.children !== undefined) props.children = resolveFixtureValue(ref.children, element)
  return element(component, props)
}

export function resolveFixtureValue(value: FixtureValue, element: ElementFactory): unknown {
  if (typeof value === "string") {
    if (value.startsWith("{")) {
      try {
        const parsed = JSON.parse(value)
        if (parsed && typeof parsed === "object" && "$component" in parsed) {
          return renderRef(parsed as ComponentRef, element)
        }
      } catch {
        // not JSON: fall through to the plain string
      }
    }
    return value
  }
  return renderRef(value, element)
}

/** Core coercion bound to this registry's children renderer. */
export function coerceProps(
  spec: SteerComponentSpec,
  values: Record<string, string | undefined>,
  element: ElementFactory
): Record<string, unknown> {
  return coercePropsCore(spec, values, (value) => resolveFixtureValue(value, element))
}

// --- deferred element materialization ---------------------------------------
// A prebuilt chrome bundles its own framework runtime, so when the host is
// built with the same framework there are two independent runtimes. Ownership
// cannot cross that line: an instance created by the host's runtime while only
// the chrome's runtime has a current owner is unowned, so its effects never
// dispose.
//
// The chrome therefore never builds instances. It leaves a marker, and the
// Mounter materializes it inside its OWN scope, where the host runtime's owner
// is the mounted tree. Framework free, so it lives here.

const REF = "__steerElement"

interface DeferredElement {
  readonly [REF]: true
  component: unknown
  props: Record<string, unknown>
}

function isDeferred(value: unknown): value is DeferredElement {
  return typeof value === "object" && value !== null && REF in value
}

/** The chrome's element factory: records what to build, builds nothing. */
export function deferElement(component: unknown, props: Record<string, unknown>): unknown {
  return { [REF]: true, component, props } satisfies DeferredElement
}

/** The mounter's counterpart, called inside the host runtime's owner. */
export function materialize(
  values: Record<string, unknown>,
  element: ElementFactory
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(values)) out[key] = materializeValue(value, element)
  return out
}

function materializeValue(value: unknown, element: ElementFactory): unknown {
  if (!isDeferred(value)) return value
  return element(value.component, materialize(value.props, element))
}
