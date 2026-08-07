import { describe, expect, it } from "vitest"
import { runDoctor } from "./doctor"
import { buildManifest } from "./manifest"

const BUTTON = {
  path: "src/components/Button.tsx",
  source: `interface ButtonProps { variant?: "a" | "b" }\nexport function Button(p: ButtonProps) { return null }`,
}

const rebuilt = buildManifest({
  root: "/host",
  generatedAt: "2026-01-01T00:00:00.000Z",
  componentFiles: [BUTTON],
  scanFiles: [BUTTON],
})

describe("doctor checks", () => {
  it("fails when no manifest is stored", () => {
    const report = runDoctor({ stored: undefined, rebuilt, fixtures: {}, notes: {} })
    expect(report.status).toBe("fail")
    expect(report.checks[0].id).toBe("manifest-present")
  })

  it("passes on a fresh manifest even if timestamps differ", () => {
    const stored = { ...rebuilt, generatedAt: "2027-12-31T23:59:59.000Z" }
    const report = runDoctor({ stored, rebuilt, fixtures: {}, notes: {} })
    expect(report.status).toBe("pass")
  })

  it("fails on a stale manifest", () => {
    const stored = { ...rebuilt, components: [] }
    const report = runDoctor({ stored, rebuilt, fixtures: {}, notes: {} })
    expect(report.checks.some((c) => c.id === "manifest-fresh" && c.status === "fail")).toBe(true)
  })

  it("fails on unparseable fixtures and warns on unknown props", () => {
    const report = runDoctor({
      stored: rebuilt,
      rebuilt,
      fixtures: {
        button: `{ "states": { "default": { "variant": "a", "ghost": "x" } } }`,
        broken: `{ nope`,
      },
      notes: {},
    })
    expect(report.status).toBe("fail")
    expect(report.checks.some((c) => c.id === "fixture-parse" && c.status === "fail")).toBe(true)
    expect(
      report.checks.some((c) => c.id === "fixture-prop" && c.detail.includes(`"ghost"`))
    ).toBe(true)
  })

  it("warns when an open note points at a component that no longer exists", () => {
    const report = runDoctor({
      stored: rebuilt,
      rebuilt,
      fixtures: {},
      notes: {
        legacy: [
          {
            id: "note_1",
            component: "legacy",
            stateUrl: "/__bench/legacy?x=1",
            selector: "button",
            coords: { x: 0.5, y: 0.5 },
            text: "orphaned",
            author: "andres",
            status: "open",
            created: "2026-01-01T00:00:00.000Z",
          },
        ],
      },
    })
    expect(report.status).toBe("warn")
    expect(report.checks.some((c) => c.id === "note-state-url")).toBe(true)
  })

  it("resolved notes on gone components stay silent (history, not debt)", () => {
    const report = runDoctor({
      stored: rebuilt,
      rebuilt,
      fixtures: {},
      notes: {
        legacy: [
          {
            id: "note_1",
            component: "legacy",
            stateUrl: "/__bench/legacy?x=1",
            selector: "button",
            coords: { x: 0.5, y: 0.5 },
            text: "done long ago",
            author: "andres",
            status: "resolved",
            created: "2026-01-01T00:00:00.000Z",
          },
        ],
      },
    })
    expect(report.status).toBe("pass")
  })
})
