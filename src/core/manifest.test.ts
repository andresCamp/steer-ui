import { describe, expect, it } from "vitest"
import { buildManifest, type ManifestInput } from "./manifest"

const BUTTON = {
  path: "src/components/Button.tsx",
  source: `interface ButtonProps { variant?: "a" | "b" }\nexport function Button(p: ButtonProps) { return null }`,
}
const CARD = {
  path: "src/components/Card.tsx",
  source: `export function Card() { return <div><Button /></div> }`,
}
const PAGE = {
  path: "src/demo/Page.tsx",
  source: `export function Page() { return <div><Button /><Card.Actions /></div> }`,
}
const BENCH_UI = {
  path: "src/bench/BenchIndex.tsx",
  source: `export function BenchIndex() { return <Button /> }`,
}

const input = (over: Partial<ManifestInput> = {}): ManifestInput => ({
  root: "/host",
  generatedAt: "2026-01-01T00:00:00.000Z",
  componentFiles: [BUTTON, CARD],
  scanFiles: [BUTTON, CARD, PAGE, BENCH_UI],
  ...over,
})

describe("buildManifest", () => {
  it("is a pure function of source: same input, byte-identical output", () => {
    const a = JSON.stringify(buildManifest(input()))
    const b = JSON.stringify(buildManifest(input()))
    expect(a).toBe(b)
  })

  it("scans usages, tags intra-library ones internal, skips self and bench dirs", () => {
    const manifest = buildManifest(input())
    const button = manifest.components.find((c) => c.name === "Button")!
    expect(button.usages).toEqual([
      {
        file: "src/components/Card.tsx",
        line: 1,
        snippet: expect.stringContaining("<Button />"),
        internal: true,
      },
      { file: "src/demo/Page.tsx", line: 1, snippet: expect.stringContaining("<Button />") },
    ])
  })

  it("matches dotted compound usages", () => {
    const compound = {
      path: "src/components/Card.tsx",
      source: `export function Card() { return null }\nexport function CardActions() { return null }\nCard.Actions = CardActions`,
    }
    const manifest = buildManifest(
      input({ componentFiles: [compound], scanFiles: [compound, PAGE] })
    )
    const actions = manifest.components.find((c) => c.name === "Card.Actions")!
    expect(actions.usages).toEqual([
      { file: "src/demo/Page.tsx", line: 1, snippet: expect.stringContaining("<Card.Actions />") },
    ])
  })

  it("de-collides duplicate slugs and surfaces a warning (invariant 4)", () => {
    const dupe = {
      path: "src/components/other/Button.tsx",
      source: `export function Button() { return null }`,
    }
    const manifest = buildManifest(input({ componentFiles: [BUTTON, dupe] }))
    const slugs = manifest.components.map((c) => c.slug).sort()
    expect(slugs).toEqual(["button", "button-2"])
    expect(manifest.warnings).toHaveLength(1)
    expect(manifest.warnings![0]).toContain("duplicate component name")
  })

  it("de-collides duplicate compound names too (lineage bug, fixed)", () => {
    const one = {
      path: "src/components/Card.tsx",
      source: `export function Card() { return null }\nexport function CardActions() { return null }\nCard.Actions = CardActions`,
    }
    const two = {
      path: "src/components/other/Card.tsx",
      source: `export function Card() { return null }\nexport function CardActions() { return null }\nCard.Actions = CardActions`,
    }
    const manifest = buildManifest(input({ componentFiles: [one, two], scanFiles: [] }))
    const actionSlugs = manifest.components
      .filter((c) => c.name === "Card.Actions")
      .map((c) => c.slug)
      .sort()
    expect(actionSlugs).toEqual(["card-actions", "card-actions-2"])
  })

  it("treats explicitly-undefined config fields as absent", () => {
    const manifest = buildManifest(
      input({ config: { componentDir: undefined, excludeDirs: undefined } })
    )
    const button = manifest.components.find((c) => c.name === "Button")!
    expect(button.usages.some((u) => u.file.startsWith("src/bench"))).toBe(false)
  })

  it("sorts components by name for stable output", () => {
    const manifest = buildManifest(input())
    const names = manifest.components.map((c) => c.name)
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)))
  })
})
