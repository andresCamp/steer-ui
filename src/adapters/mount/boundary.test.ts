import { existsSync, readFileSync, readdirSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

// "We shouldn't inject Solid code into a Next project" as an executable rule.
//
// The whole architecture rests on framework code being confined to one tiny
// file per framework. If a framework import ever leaks into core, ports, or
// another framework's mounter, the host would be forced to compile it, and
// the claim that a React or Next host never sees Solid quietly stops being
// true. That regression is invisible at runtime and obvious here.

const SRC = path.resolve(import.meta.dirname, "../..")
const CHROME_DIST = path.resolve(SRC, "../dist/chrome")

const FRAMEWORKS = ["solid-js", "react", "react-dom", "vue", "svelte"]

// One entry per shipped mounter. Adding a framework means adding a line here
// and a line in the contract suite, and nothing else.
const MOUNTERS = [
  { file: "adapters/mount/solid.ts", allowed: "solid-js" },
  { file: "adapters/mount/react.ts", allowed: "react" },
  { file: "adapters/mount/vue.ts", allowed: "vue" },
  { file: "adapters/mount/svelte.svelte.ts", allowed: "svelte" },
]

/** Every import specifier in a file, relative ones included. */
function allSpecifiers(file: string): string[] {
  const source = readFileSync(file, "utf8")
  const out: string[] = []
  const pattern = /(?:^|\n)\s*(?:import|export)\s[^\n]*?from\s+["']([^"']+)["']/g
  for (const match of source.matchAll(pattern)) if (match[1]) out.push(match[1])
  return out
}

/** Where a relative specifier actually lands, so "../chrome/x" is caught the
 *  same as "adapters/chrome/x". A textual check misses the shorter form, which
 *  is the one anyone writing from adapters/mount would naturally reach for. */
function resolvedTargets(file: string): string[] {
  return allSpecifiers(file)
    .filter((spec) => spec.startsWith("."))
    .map((spec) => path.resolve(path.dirname(file), spec))
}

/** Bare module specifiers this file imports, ignoring relative paths. */
function importsOf(file: string): string[] {
  const source = readFileSync(file, "utf8")
  const specifiers: string[] = []
  const pattern = /(?:^|\n)\s*(?:import|export)\s[^\n]*?from\s+["']([^"']+)["']/g
  for (const match of source.matchAll(pattern)) {
    const spec = match[1]
    if (spec && !spec.startsWith(".") && !spec.startsWith("node:")) specifiers.push(spec)
  }
  return specifiers
}

function frameworksIn(file: string): string[] {
  return importsOf(file)
    .map((spec) => FRAMEWORKS.find((fw) => spec === fw || spec.startsWith(`${fw}/`)))
    .filter((fw): fw is string => Boolean(fw))
}

function sourcesUnder(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile() && /\.tsx?$/.test(entry.name) && !entry.name.includes(".test."))
    .map((entry) => path.join(entry.parentPath ?? dir, entry.name))
}

describe("framework boundary", () => {
  it("confines each mounter to its own framework", () => {
    for (const { file: rel, allowed } of MOUNTERS) {
      const file = path.join(SRC, rel)
      const found = frameworksIn(file)
      const foreign = found.filter((fw) => !fw.startsWith(allowed))
      expect(foreign, `${path.basename(file)} imports a foreign framework`).toEqual([])
      expect(found.length, `${path.basename(file)} should import its own framework`).toBeGreaterThan(0)
    }
  })

  it("keeps core free of every framework", () => {
    for (const file of sourcesUnder(path.join(SRC, "core"))) {
      expect(frameworksIn(file), `${path.relative(SRC, file)} imports a framework`).toEqual([])
    }
  })

  it("keeps the port contract free of every framework", () => {
    for (const file of sourcesUnder(path.join(SRC, "ports"))) {
      expect(frameworksIn(file), `${path.relative(SRC, file)} imports a framework`).toEqual([])
    }
  })

  // The hexagon's direction of dependency. Core is the domain; adapters bind it
  // to a technology. Core reaching into adapters inverts that and is how a pure
  // engine quietly acquires a dependency on Vue's file format.
  it("keeps core from importing adapters", () => {
    const adapters = path.join(SRC, "adapters")
    for (const file of sourcesUnder(path.join(SRC, "core"))) {
      const reaching = resolvedTargets(file).filter((t) => t.startsWith(adapters))
      expect(reaching, `${path.relative(SRC, file)} imports an adapter`).toEqual([])
    }
  })

  // The bridge is the one module both artifacts load. If it ever pulls in a
  // framework, the prebuilt chrome stops being host-agnostic.
  it("keeps the bridge importing nothing at all", () => {
    expect(importsOf(path.join(SRC, "core/bridge.ts"))).toEqual([])
  })

  // The chrome IS Solid, and that is fine because it ships prebuilt. What must
  // never happen is a host importing it: that is what would drag Solid into a
  // Next or Vue build. The host's entry reaches steer-ui through core/bridge
  // and one mounter, and nothing else.
  it("keeps the chrome out of anything a host compiles", () => {
    const hostCompiled = [
      path.join(SRC, "core/bridge.ts"),
      path.join(SRC, "core/registry.ts"),
      ...MOUNTERS.map((m) => path.join(SRC, m.file)),
    ]
    const chrome = path.join(SRC, "adapters/chrome")
    for (const file of hostCompiled) {
      const reaching = resolvedTargets(file).filter((t) => t.startsWith(chrome))
      expect(reaching, `${path.relative(SRC, file)} reaches into the chrome`).toEqual([])
    }
  })
})

// The architecture's central claim, checked against the artifact rather than
// the source: if the built chrome still imported a framework, the host would
// have to supply it, and "a React host never sees Solid" would be false.
describe.skipIf(!existsSync(path.join(CHROME_DIST, "bench.js")))(
  "built chrome is self-contained",
  () => {
    const bundles = () =>
      readdirSync(CHROME_DIST).filter((f) => f.endsWith(".js"))

    it("ships both entries", () => {
      expect(bundles()).toEqual(expect.arrayContaining(["bench.js", "overlay.js"]))
    })

    it("has no bare module imports left to resolve", () => {
      for (const file of bundles()) {
        const source = readFileSync(path.join(CHROME_DIST, file), "utf8")
        const bare = [...source.matchAll(/(?:from|import)\s*["']([^"'.][^"']*)["']/g)].map(
          (m) => m[1]
        )
        expect(bare, `${file} expects the host to provide ${bare.join(", ")}`).toEqual([])
      }
    })
  }
)
