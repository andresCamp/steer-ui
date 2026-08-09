// steer domain model. Pure types, zero I/O, zero framework. The hexagon's center.
//
// Invariants everything downstream must hold:
//   1. The manifest is derived, never authored — regeneration is a pure function of
//      source text; a hand edit is overwritten on the next change and means nothing.
//   2. Every state is addressable — any renderable knob configuration round-trips
//      through the state URL grammar, including composed component children.
//   3. Feedback is data and append-preserving — the engine never deletes a note or
//      reply; resolution is a status flip, deletion is a human act outside the engine.
//   4. Degrade visibly, never crash — unsupported prop types, missing fixtures, and
//      unknown components become warnings and no-op fallbacks the operator can see.
//   5. The contract is framework-neutral — manifest schema, state URL grammar, notes
//      shape, and the .steer/ layout are identical across frameworks and bundlers;
//      only extractors, transports, and render surfaces vary.

export interface SteerProp {
  name: string
  kind: "enum" | "boolean" | "string" | "number" | "children" | "unsupported"
  options?: string[]
  /** True when enum options are numeric literals; coerce back to number. */
  numeric?: boolean
  optional: boolean
  description?: string
  raw: string
}

export interface SteerUsage {
  file: string
  line: number
  snippet: string
  /** Usage inside the component library itself (composition), not the app. */
  internal?: boolean
}

export interface SteerComponentSpec {
  name: string
  slug: string
  file: string
  description?: string
  /** For compound components: the underlying function's export name. */
  target?: string
  props: SteerProp[]
  usages: SteerUsage[]
}

export interface SteerManifest {
  generatedAt: string
  root: string
  warnings?: string[]
  components: SteerComponentSpec[]
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

export interface SteerFixture {
  states: Record<string, Record<string, FixtureValue>>
}

export interface SteerReply {
  id: string
  author: string
  text: string
  created: string
}

export interface SteerNote {
  id: string
  component: string
  stateUrl: string
  selector: string
  /** Stage-relative fractions; may exceed 0..1 for notes on the empty canvas. */
  coords: { x: number; y: number }
  /** Optional highlighted region (stage-relative fractions, same coordinate space). */
  rect?: { x: number; y: number; w: number; h: number }
  text: string
  author: string
  status: "open" | "resolved"
  created: string
  replies?: SteerReply[]
}

export type NoteInput = Pick<
  SteerNote,
  "stateUrl" | "selector" | "coords" | "rect" | "text" | "author"
>

/** A source file handed to the engine; path is relative to the host root. */
export interface SourceFile {
  path: string
  source: string
}

export interface SteerConfig {
  /** Where components live, relative to the host root. */
  componentDir: string
  /** Directories excluded from the usage scan (the steer's own machinery). */
  excludeDirs: string[]
  /**
   * Resolve Props types through the TypeScript checker (imported, aliased,
   * and intersection types become real knobs). Costs a virtual program per
   * regeneration; syntactic extraction stays the default.
   */
  typecheck: boolean
}

export const DEFAULT_CONFIG: SteerConfig = {
  componentDir: "src/components",
  excludeDirs: ["src/steer"],
  typecheck: false,
}

/** The route base is part of the contract, not configuration. */
export const STEER_BASE = "/__steer"

export type DoctorStatus = "pass" | "warn" | "fail"

export interface DoctorCheck {
  id: string
  status: DoctorStatus
  detail: string
}

export interface DoctorReport {
  status: DoctorStatus
  checks: DoctorCheck[]
}
