#!/usr/bin/env node
import path from "node:path"
import { applyPlan, fsProbe } from "./apply"
import { planInit, type Framework, type InitOptions } from "./plan"

// The command an agent runs after it has read the repository. Flags carry the
// judgment it made; with none it detects. Everything it prints is addressed to
// the agent, not to a person: a person should only ever see the last line.

const FRAMEWORKS: Framework[] = ["solid", "react", "vue", "svelte"]

const USAGE = `steer-ui init [options]

  --root <dir>          project root (default: cwd)
  --framework <name>    ${FRAMEWORKS.join(" | ")} (default: detected from dependencies)
  --components <dir>    where your components live (default: detected)
  --register <file>     where to write the glue (default: beside the components)
  --styles <file>       your stylesheet, loaded into the bench (default: detected)
  --typecheck           resolve imported prop types through the TS checker
  --author <name>       who notes are attributed to
`

interface Parsed {
  root: string
  options: InitOptions
  help: boolean
}

export function parseArgs(argv: string[]): Parsed | { error: string } {
  const options: InitOptions = {}
  let root = process.cwd()
  let help = false

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    const value = () => argv[++i]
    switch (arg) {
      case "--help":
      case "-h":
        help = true
        break
      case "--root":
        root = path.resolve(value() ?? "")
        break
      case "--framework": {
        const given = value()
        if (!FRAMEWORKS.includes(given as Framework)) {
          return { error: `--framework must be one of ${FRAMEWORKS.join(", ")}` }
        }
        options.framework = given as Framework
        break
      }
      case "--components":
        options.componentDir = value()
        break
      case "--register":
        options.register = value()
        break
      case "--styles":
        options.styles = value()
        break
      case "--typecheck":
        options.typecheck = true
        break
      case "--author":
        options.author = value()
        break
      default:
        if (arg && arg !== "init") return { error: `unknown option ${arg}` }
    }
  }
  return { root, options, help }
}

export function run(argv: string[], version: string, now: string): number {
  const parsed = parseArgs(argv)
  if ("error" in parsed) {
    console.error(`steer-ui: ${parsed.error}\n\n${USAGE}`)
    return 1
  }
  if (parsed.help) {
    console.log(USAGE)
    return 0
  }

  const result = planInit(fsProbe(parsed.root), parsed.options)
  if (!result.ok) {
    // Named so the agent can correct itself and re-run without asking anyone.
    console.error(`steer-ui: ${result.refusal.problem}\n  fix: ${result.refusal.fix}`)
    return 1
  }

  const receipt = applyPlan(result.plan, { root: parsed.root, version, now })

  for (const note of result.plan.notes) console.log(`note: ${note}`)
  for (const file of receipt.created) console.log(`wrote  ${file}`)
  for (const file of receipt.alreadyPresent) console.log(`kept   ${file} (already there, left alone)`)

  console.log(`
One edit left, because steer-ui will not touch your bundler config:

${result.plan.snippet}

Then start the dev server and open /__steer`)
  return 0
}
