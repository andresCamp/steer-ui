import { describe, expect, it } from "vitest"
import { createEngine } from "./engine"
import {
  fixedClock,
  memoryFixtures,
  memoryManifest,
  memoryNotes,
  memorySources,
  seqIds,
} from "../adapters/memory"

const BUTTON = {
  path: "src/components/Button.tsx",
  source: `interface ButtonProps { variant?: "a" | "b" }\nexport function Button(p: ButtonProps) { return null }`,
}

const wire = (over: Partial<Parameters<typeof createEngine>[0]> = {}) => {
  const manifestStore = memoryManifest()
  const notes = memoryNotes()
  const fixtures = memoryFixtures({ button: `{ "states": { "default": { "variant": "a" } } }` })
  const engine = createEngine({
    sources: memorySources("/host", [BUTTON]),
    manifestStore,
    fixtures,
    notes,
    clock: fixedClock(),
    ids: seqIds(),
    ...over,
  })
  return { engine, manifestStore, notes, fixtures }
}

describe("engine (the driving port)", () => {
  it("regenerate derives the manifest and persists it (invariant 1)", async () => {
    const { engine, manifestStore } = wire()
    expect(await engine.manifest()).toBeUndefined()
    const manifest = await engine.regenerate()
    expect(manifest.components.map((c) => c.slug)).toEqual(["button"])
    expect(manifestStore.current()).toEqual(manifest)
  })

  it("runs the full note lifecycle deterministically", async () => {
    const { engine, notes } = wire()
    const note = (await engine.addNote("button", {
      stateUrl: "/__steer/button?variant=b",
      selector: "button",
      coords: { x: 0.5, y: 0.5 },
      text: "too loud",
      author: "andres",
    }))!
    expect(note.id).toBe("note_0001")
    await engine.reply("button", note.id, "toned down to b2", "agent")
    const resolved = (await engine.resolve("button", note.id))!
    expect(resolved.status).toBe("resolved")
    const all = notes.all().button
    expect(all).toHaveLength(1)
    expect(all[0].replies).toHaveLength(1)
    expect(all[0].status).toBe("resolved")
  })

  it("degrades gracefully without optional ports (invariant 4)", async () => {
    const { engine } = wire({ fixtures: undefined, notes: undefined })
    expect(await engine.fixture("button")).toEqual({ states: {} })
    expect(await engine.notes("button")).toEqual([])
    expect(
      await engine.addNote("button", {
        stateUrl: "",
        selector: "",
        coords: { x: 0, y: 0 },
        text: "x",
        author: "a",
      })
    ).toBeUndefined()
  })

  it("returns empty states for a malformed fixture instead of crashing", async () => {
    const { engine, fixtures } = wire()
    fixtures.set("button", "{ not json")
    expect(await engine.fixture("button")).toEqual({ states: {} })
  })

  it("doctor passes when fresh and fails when source drifts", async () => {
    const { engine } = wire()
    await engine.regenerate()
    expect((await engine.doctor()).status).toBe("pass")

    const drifted = wire({
      sources: memorySources("/host", [
        {
          path: "src/components/Button.tsx",
          source: `interface ButtonProps { variant?: "a" | "b" | "c" }\nexport function Button(p: ButtonProps) { return null }`,
        },
      ]),
    })
    await drifted.engine.regenerate()
    // Same engine regenerated: fresh. A different source set against the
    // stored manifest of the first: stale.
    const stale = createEngine({
      sources: memorySources("/host", [BUTTON]),
      manifestStore: memoryManifest(await drifted.engine.manifest()),
      clock: fixedClock(),
      ids: seqIds(),
    })
    const report = await stale.doctor()
    expect(report.status).toBe("fail")
    expect(report.checks.some((c) => c.id === "manifest-fresh" && c.status === "fail")).toBe(true)
  })
})
