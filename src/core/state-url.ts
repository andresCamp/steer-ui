import { STEER_BASE, type SteerComponentSpec, type FixtureValue } from "./model"

// The state URL grammar: /__steer/<slug>?prop=value&... Every knob
// configuration is addressable; composed children ride as JSON strings.
// This grammar is the contract's spine — encode and decode live together
// here so no surface can drift.

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

/** Serialize knob values into a shareable steer URL. */
export function stateUrl(slug: string, values: Record<string, string>): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(values)) {
    if (value !== "" && value !== undefined) params.set(key, value)
  }
  const query = params.toString()
  return `${STEER_BASE}/${slug}${query ? `?${query}` : ""}`
}

/** Decode a state URL back into its slug and knob values. */
export function parseStateUrl(url: string): { slug: string; values: Record<string, string> } {
  const [path, query] = url.split("?")
  const slug = path.startsWith(`${STEER_BASE}/`) ? path.slice(STEER_BASE.length + 1) : path
  const values: Record<string, string> = {}
  new URLSearchParams(query ?? "").forEach((value, key) => (values[key] = value))
  return { slug, values }
}

/** Canonical key for a knob-value set, order-independent. */
export function stateKey(values: Record<string, string>): string {
  return JSON.stringify(Object.entries(values).sort(([a], [b]) => a.localeCompare(b)))
}

/** Do two knob-value sets describe the same rendered state? */
export function sameState(a: Record<string, string>, b: Record<string, string>): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  for (const key of keys) {
    if ((a[key] ?? "") !== (b[key] ?? "")) return false
  }
  return true
}

/**
 * Turn URL search params (all strings) into typed props per the manifest.
 * Children values may be JSON component references; the render surface
 * passes `resolveChildren` to turn them into framework elements — without
 * it they stay strings (URL round-trips remain lossless either way).
 */
export function coerceProps(
  spec: SteerComponentSpec,
  values: Record<string, string | undefined>,
  resolveChildren?: (value: string) => unknown
): Record<string, unknown> {
  const props: Record<string, unknown> = {}
  for (const prop of spec.props) {
    const value = values[prop.name]
    if (value === undefined || value === "") {
      // Declared, but unset. The key still has to exist: the manifest defines
      // the component's prop set, and frameworks snapshot the prop KEYS when
      // the component mounts (Solid's mergeProps does). A key that only appears
      // once a knob is first touched is invisible forever after, so the canvas
      // shows a stale component while the state URL says otherwise.
      // undefined is also what every framework reads as "use your default".
      props[prop.name] = undefined
      continue
    }
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
        props[prop.name] = resolveChildren ? resolveChildren(value) : value
        break
    }
  }
  return props
}
