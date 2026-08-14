import { describe, expect, it } from "vitest"
import { planInit, type Probe } from "./plan"

// init runs inside somebody else's repository, which is the one place a mistake
// is expensive and the one place I cannot iterate. Every detection rule and
// every refusal is pinned here rather than discovered by a stranger.

function probe(files: Record<string, unknown>): Probe {
  const paths = new Set(Object.keys(files))
  return {
    exists: (rel) => paths.has(rel),
    readJson: (rel) => (files[rel] as Record<string, unknown> | undefined) ?? undefined,
  }
}

const vueProject = {
  "package.json": { dependencies: { vue: "^3.5.0" } },
  "src/components": true,
  "src/app.css": true,
}

function planOf(files: Record<string, unknown>, options = {}) {
  const result = planInit(probe(files), options)
  if (!result.ok) throw new Error(`refused: ${result.refusal.problem}`)
  return result.plan
}

describe("detection", () => {
  it("reads the framework from dependencies", () => {
    expect(planOf(vueProject).framework).toBe("vue")
    expect(planOf({ ...vueProject, "package.json": { dependencies: { "solid-js": "^1" } } }).framework).toBe("solid")
    expect(planOf({ ...vueProject, "package.json": { devDependencies: { svelte: "^5" } } }).framework).toBe("svelte")
  })

  // A React app can pull solid-js in transitively. Ordering, not presence.
  it("prefers the more specific framework when several are present", () => {
    const files = { ...vueProject, "package.json": { dependencies: { react: "^19", "solid-js": "^1" } } }
    expect(planOf(files).framework).toBe("solid")
  })

  it("finds components outside the default directory", () => {
    const files = { "package.json": { dependencies: { react: "^19" } }, "app/ui": true }
    expect(planOf(files).componentDir).toBe("app/ui")
  })

  it("puts the register file beside the components, not at the root", () => {
    expect(planOf(vueProject).register).toBe("src/steer.ts")
    const nested = { "package.json": { dependencies: { react: "^19" } }, "src/lib/components": true }
    expect(planOf(nested).register).toBe("src/lib/steer.ts")
  })

  it("finds a stylesheet, and says so when it cannot", () => {
    expect(planOf(vueProject).styles).toBe("src/app.css")
    const bare = { "package.json": { dependencies: { vue: "^3" } }, "src/components": true }
    const plan = planOf(bare)
    expect(plan.styles).toBeUndefined()
    expect(plan.notes.join(" ")).toContain("without the app's own CSS")
  })
})

describe("refusals name the flag that fixes them", () => {
  // An agent reads these and corrects itself. A human should never see one.
  it("refuses outside a JavaScript project", () => {
    const result = planInit(probe({}))
    expect(result).toMatchObject({ ok: false, refusal: { fix: expect.stringContaining("--root") } })
  })

  it("refuses when the framework is unknowable", () => {
    const result = planInit(probe({ "package.json": { dependencies: {} }, "src/components": true }))
    expect(result).toMatchObject({ ok: false, refusal: { fix: expect.stringContaining("--framework") } })
  })

  it("refuses when no component directory exists", () => {
    const result = planInit(probe({ "package.json": { dependencies: { vue: "^3" } } }))
    expect(result).toMatchObject({ ok: false, refusal: { fix: expect.stringContaining("--components") } })
  })

  it("refuses a --components path that is not there", () => {
    const result = planInit(probe(vueProject), { componentDir: "src/widgets" })
    expect(result).toMatchObject({ ok: false })
    if (!result.ok) expect(result.refusal.problem).toContain("src/widgets")
  })

  it("refuses a --styles path that is not there", () => {
    const result = planInit(probe(vueProject), { styles: "src/nope.css" })
    expect(result).toMatchObject({ ok: false })
    if (!result.ok) expect(result.refusal.problem).toContain("src/nope.css")
  })
})

describe("the register file it writes", () => {
  it("globs the right extension for the framework", () => {
    expect(planOf(vueProject).files[0]!.contents).toContain('import.meta.glob("./components/**/*.vue"')
    const react = { ...vueProject, "package.json": { dependencies: { react: "^19" } } }
    expect(planOf(react).files[0]!.contents).toContain('import.meta.glob("./components/**/*.tsx"')
  })

  it("globs relative to the register file, not the project root", () => {
    const nested = { "package.json": { dependencies: { react: "^19" } }, "src/lib/components": true }
    expect(planOf(nested).files[0]!.contents).toContain('"./components/**/*.tsx"')
  })

  it("imports the mounter for that framework and nothing else", () => {
    const contents = planOf(vueProject).files[0]!.contents
    expect(contents).toContain('from "steer-ui/mount/vue"')
    expect(contents).not.toMatch(/mount\/(solid|react|svelte)/)
  })

  it("records the author so notes are attributed", () => {
    expect(planOf(vueProject, { author: "andrés" }).files[0]!.contents).toContain('author: "andrés"')
  })

  // The bench shipping to production is a bug, not a preference, so the file
  // says so where someone will actually read it.
  it("warns in the file itself that the app must not import it", () => {
    expect(planOf(vueProject).files[0]!.contents).toContain("never by the app")
  })
})

describe("what it leaves for the agent", () => {
  // The CLI never edits the bundler config: arbitrary shape, and damaging
  // someone's config is the one unrecoverable outcome.
  it("hands back a plugin snippet carrying the resolved paths", () => {
    const plan = planOf(vueProject, { typecheck: true })
    expect(plan.snippet).toContain('from "steer-ui/vite"')
    expect(plan.snippet).toContain('componentDir: "src/components"')
    expect(plan.snippet).toContain('register: "src/steer.ts"')
    expect(plan.snippet).toContain('styles: "src/app.css"')
    expect(plan.snippet).toContain("typecheck: true")
  })

  it("leaves typecheck out of the snippet unless asked for", () => {
    expect(planOf(vueProject).snippet).not.toContain("typecheck")
  })

  it("scaffolds the data directories and gitignores only the derived file", () => {
    const plan = planOf(vueProject)
    expect(plan.directories).toEqual([".steer/fixtures", ".steer/notes"])
    expect(plan.gitignore).toEqual([".steer/manifest.json"])
  })
})
