import { readdirSync, readFileSync } from "node:fs"
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

const FRAMEWORKS = ["solid-js", "react", "react-dom", "vue", "svelte"]

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
    const cases = [
      { file: path.join(SRC, "adapters/mount/solid.ts"), allowed: "solid-js" },
      { file: path.join(SRC, "adapters/mount/react.ts"), allowed: "react" },
    ]
    for (const { file, allowed } of cases) {
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

  // The bridge is the one module both artifacts load. If it ever pulls in a
  // framework, the prebuilt chrome stops being host-agnostic.
  it("keeps the bridge importing nothing at all", () => {
    expect(importsOf(path.join(SRC, "core/bridge.ts"))).toEqual([])
  })
})
