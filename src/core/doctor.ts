import type {
  BenchFixture,
  BenchManifest,
  BenchNote,
  DoctorCheck,
  DoctorReport,
} from "./model"
import { parseStateUrl } from "./state-url"

// Doctor: deterministic health checks over the engine's artifacts. Pure —
// the caller gathers state (stored manifest, a fresh rebuild, raw fixture
// text, notes) and this module judges it. "fail" means the bench lies or
// cannot answer; "warn" means it works but something will confuse an agent.

export interface DoctorInput {
  stored: BenchManifest | undefined
  /** Freshly derived from current sources by the caller. */
  rebuilt: BenchManifest
  /** slug -> raw fixture file text */
  fixtures: Record<string, string>
  /** slug -> notes */
  notes: Record<string, BenchNote[]>
}

/** Manifest equality that ignores the generation timestamp. */
function sameManifest(a: BenchManifest, b: BenchManifest): boolean {
  const strip = ({ generatedAt: _ignored, ...rest }: BenchManifest) => rest
  return JSON.stringify(strip(a)) === JSON.stringify(strip(b))
}

function parseFixture(raw: string): BenchFixture | undefined {
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === "object" && typeof parsed.states === "object") {
      return parsed as BenchFixture
    }
  } catch {
    // fall through: caller reports the parse failure
  }
  return undefined
}

export function runDoctor(input: DoctorInput): DoctorReport {
  const checks: DoctorCheck[] = []
  const slugs = new Set(input.rebuilt.components.map((c) => c.slug))
  const specBySlug = new Map(input.rebuilt.components.map((c) => [c.slug, c]))

  if (!input.stored) {
    checks.push({
      id: "manifest-present",
      status: "fail",
      detail: "no manifest stored; the bench cannot answer until one is generated",
    })
  } else if (!sameManifest(input.stored, input.rebuilt)) {
    checks.push({
      id: "manifest-fresh",
      status: "fail",
      detail: "stored manifest does not match current source; regenerate",
    })
  } else {
    checks.push({
      id: "manifest-fresh",
      status: "pass",
      detail: `manifest matches source (${input.rebuilt.components.length} components)`,
    })
  }

  for (const warning of input.rebuilt.warnings ?? []) {
    checks.push({ id: "manifest-warning", status: "warn", detail: warning })
  }

  for (const [slug, raw] of Object.entries(input.fixtures)) {
    const fixture = parseFixture(raw)
    if (!fixture) {
      checks.push({
        id: "fixture-parse",
        status: "fail",
        detail: `fixture "${slug}" is not valid JSON of shape { states: {...} }`,
      })
      continue
    }
    if (!slugs.has(slug)) {
      checks.push({
        id: "fixture-component",
        status: "warn",
        detail: `fixture "${slug}" has no matching component in the manifest`,
      })
      continue
    }
    const spec = specBySlug.get(slug)!
    const known = new Set(spec.props.map((p) => p.name))
    for (const [state, values] of Object.entries(fixture.states)) {
      for (const prop of Object.keys(values)) {
        if (!known.has(prop)) {
          checks.push({
            id: "fixture-prop",
            status: "warn",
            detail: `fixture "${slug}" state "${state}" sets unknown prop "${prop}"`,
          })
        }
      }
    }
  }

  for (const [slug, notes] of Object.entries(input.notes)) {
    for (const note of notes) {
      if (note.status !== "open") continue
      const { slug: noteSlug } = parseStateUrl(note.stateUrl)
      if (!slugs.has(noteSlug)) {
        checks.push({
          id: "note-state-url",
          status: "warn",
          detail: `open note ${note.id} (${slug}) points at unknown component "${noteSlug}"`,
        })
      }
    }
  }

  if (checks.length === 0 || checks.every((c) => c.status === "pass")) {
    checks.push({ id: "doctor", status: "pass", detail: "all checks passed" })
  }

  const status = checks.some((c) => c.status === "fail")
    ? "fail"
    : checks.some((c) => c.status === "warn")
      ? "warn"
      : "pass"
  return { status, checks }
}
