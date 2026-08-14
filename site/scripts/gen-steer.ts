/**
 * Build the site's steer data with the real engine.
 *
 * The website is a facsimile of the bench in one respect only: no dev server
 * stands behind it. Everything else is the product. The manifest here is
 * derived from this site's own component source by the lab's extractor, at
 * build time, and written out as the static API the real surface fetches.
 */
import { promises as fs } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { createEngine } from "../../src/core/engine"
import { fsFixtures, fsManifest, fsNotes, fsSources } from "../../src/adapters/node-fs"

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const apiDir = path.join(root, "public", "__steer", "api")

const engine = createEngine({
  sources: fsSources(root, { componentDir: "src/components", scanDir: "src" }),
  manifestStore: fsManifest(root),
  fixtures: fsFixtures(root),
  notes: fsNotes(root),
  config: { componentDir: "src/components", excludeDirs: ["src/steer"], typecheck: true },
})

async function writeJson(file: string, value: unknown) {
  await fs.mkdir(path.dirname(file), { recursive: true })
  await fs.writeFile(file, JSON.stringify(value, null, 2))
}

const manifest = await engine.regenerate()
await writeJson(path.join(apiDir, "manifest"), manifest)
// A .json twin, so the Astro route can import it to enumerate pages.
await writeJson(path.join(apiDir, "manifest.json"), manifest)

for (const spec of manifest.components) {
  const raw = await fsFixtures(root).readRaw(spec.slug)
  await writeJson(path.join(apiDir, "fixtures", spec.slug), raw ? JSON.parse(raw) : { states: {} })
  await writeJson(path.join(apiDir, "notes", spec.slug), await fsNotes(root).read(spec.slug))
}

await writeJson(path.join(apiDir, "doctor"), await engine.doctor())

// The site serves the SAME artifact a host installs, rather than compiling its
// own copy of the chrome. Otherwise steerui.com can look right while the
// shipped bundle is broken, or the reverse, and the shop window stops being
// evidence.
const chromeSrc = path.resolve(root, "../dist/chrome")
const chromeOut = path.join(root, "public/__steer/chrome")
try {
  await fs.rm(chromeOut, { recursive: true, force: true })
  await fs.cp(chromeSrc, chromeOut, { recursive: true })
} catch {
  throw new Error(
    `steer: no built chrome at ${chromeSrc}. Run \`pnpm build:chrome\` from the repo root first.`,
  )
}

console.log(
  `steer: ${manifest.components.length} components, ${manifest.warnings?.length ?? 0} warnings`,
)
