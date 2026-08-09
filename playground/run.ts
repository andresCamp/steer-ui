import { createEngine } from "../src/core/engine"
import { parseStateUrl, stateUrl, stringifyFixtureValues } from "../src/core/state-url"
import type { SteerFixture } from "../src/core/model"
import {
  fixedClock,
  memoryFixtures,
  memoryManifest,
  memoryNotes,
  memorySources,
  seqIds,
} from "../src/adapters/memory"
import { fsFixtures, fsSources } from "../src/adapters/node-fs"

// The CLI bench: the full engine loop, offline and deterministic. Sources
// and fixtures come from the committed playground app; notes, manifest,
// clock, and ids are in-memory stand-ins so every run prints byte-identical
// output. Run: bun playground/run.ts

const APP_ROOT = new URL("./app", import.meta.url).pathname

const heading = (text: string) => console.log(`\n\x1b[1m── ${text} ${"─".repeat(Math.max(0, 56 - text.length))}\x1b[0m`)

// Real sources read once, then frozen into memory stores so the engine
// under demonstration runs on pure adapters.
const appSources = fsSources(APP_ROOT)
const files = [...(await appSources.componentFiles()), ...(await appSources.scanFiles())]
const uniqueFiles = [...new Map(files.map((f) => [f.path, f])).values()]

const appFixtures = fsFixtures(APP_ROOT)
const fixtureRaw: Record<string, string> = {}
for (const slug of await appFixtures.list()) {
  fixtureRaw[slug] = (await appFixtures.readRaw(slug))!
}

const notes = memoryNotes()
const engine = createEngine({
  sources: memorySources("(playground)", uniqueFiles),
  manifestStore: memoryManifest(),
  fixtures: memoryFixtures(fixtureRaw),
  notes,
  clock: fixedClock("2026-01-01T09:00:00.000Z"),
  ids: seqIds(),
  config: { typecheck: true },
})

// --- 1. derive ---------------------------------------------------------------

heading("manifest: derived from source, never authored")
const manifest = await engine.regenerate()
for (const c of manifest.components) {
  const knobs = c.props.filter((p) => p.kind !== "unsupported")
  const unsupported = c.props.length - knobs.length
  console.log(
    `  ${c.name.padEnd(16)} ${c.slug.padEnd(14)} ${String(knobs.length).padStart(2)} knobs` +
      (unsupported > 0 ? ` (+${unsupported} unsupported, visible)` : "") +
      `  usages: ${c.usages.length}${c.usages.some((u) => u.internal) ? " (some internal)" : ""}`
  )
}
for (const w of manifest.warnings ?? []) console.log(`  warning: ${w}`)

// --- 1b. checked extraction --------------------------------------------------

heading("checked extraction: imported prop types become knobs")
const { buildManifest } = await import("../src/core/manifest")
const syntacticAlert = buildManifest({
  root: "(playground)",
  generatedAt: "2026-01-01T09:00:00.000Z",
  componentFiles: await memorySources("(playground)", uniqueFiles).componentFiles(),
  scanFiles: uniqueFiles,
}).components.find((c) => c.slug === "alert")
const checkedAlert = manifest.components.find((c) => c.slug === "alert")
console.log(
  `  Alert props: syntactic sees ${syntacticAlert?.props.length ?? 0} (type alias over an intersection), checked sees ${checkedAlert?.props.length ?? 0}`
)
for (const p of checkedAlert?.props ?? []) {
  console.log(
    `    ${p.name.padEnd(12)} ${p.kind}${p.options ? ` [${p.options.join(", ")}]` : ""}${p.description ? `  (${p.description})` : ""}`
  )
}

// --- 2. address --------------------------------------------------------------

heading("state URLs: every state addressable, composition included")
const cardFixture: SteerFixture = JSON.parse(fixtureRaw["card"])
for (const [name, values] of Object.entries(cardFixture.states)) {
  const url = stateUrl("card", stringifyFixtureValues(values))
  console.log(`  ${name.padEnd(12)} ${url}`)
}
const composed = stateUrl("card", stringifyFixtureValues(cardFixture.states["with-button"]))
const roundTrip = parseStateUrl(composed)
console.log(
  `  round-trip: with-button -> parse -> ${
    JSON.parse(roundTrip.values.children).$component
  } ref survives the URL`
)

// --- 3. annotate -------------------------------------------------------------

heading("notes: feedback as data, the agent loop")
const note = (await engine.addNote("button", {
  stateUrl: "/__steer/button?children=Delete+project&variant=destructive&size=lg",
  selector: "button",
  coords: { x: 0.31, y: 0.42 },
  text: "feels too wide at lg, tighten padding",
  author: "andres",
}))!
console.log(`  ${note.author} opens ${note.id}: "${note.text}"`)
const replied = (await engine.reply(
  "button",
  note.id,
  "reproduced via stateUrl; padding is px-6 at lg, proposing px-5",
  "agent"
))!
console.log(`  agent replies: "${replied.replies![0].text}"`)
const resolved = (await engine.resolve("button", note.id))!
console.log(`  agent resolves with the fix -> status: ${resolved.status} (note preserved, never deleted)`)

// --- 4. degrade visibly ------------------------------------------------------

heading("failure beats: degrade visibly, never crash")
const orphan = (await engine.addNote("legacy-widget", {
  stateUrl: "/__steer/legacy-widget?tone=warm",
  selector: "(canvas)",
  coords: { x: 0.5, y: 0.5 },
  text: "note against a component that no longer exists",
  author: "andres",
}))!
console.log(`  orphan note created against missing component: ${orphan.id}`)
console.log(`  missing fixture reads as: ${JSON.stringify(await engine.fixture("nonexistent"))}`)

// --- 5. doctor ---------------------------------------------------------------

heading("doctor: deterministic health checks")
const report = await engine.doctor()
for (const check of report.checks) {
  const mark = check.status === "pass" ? "\x1b[32mpass\x1b[0m" : check.status === "warn" ? "\x1b[33mwarn\x1b[0m" : "\x1b[31mfail\x1b[0m"
  console.log(`  ${mark}  ${check.id}: ${check.detail}`)
}
console.log(`\n  overall: ${report.status}`)

console.log(
  `\nfull loop proven offline: derive -> address -> render (see: bun run dev) -> annotate -> doctor\n`
)
