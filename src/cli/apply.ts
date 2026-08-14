import fs from "node:fs"
import path from "node:path"
import type { InitPlan } from "./plan"

// Writing the plan. Idempotent by construction: re-running repairs what is
// missing and never overwrites what is there, because a second run is the
// normal case (an agent corrects a flag and tries again) and clobbering an
// edited register file would be the worst possible response to that.

export interface Receipt {
  version: string
  installedAt: string
  framework: string
  componentDir: string
  register: string
  styles?: string
  typecheck: boolean
  author: string
  created: string[]
  alreadyPresent: string[]
}

export interface ApplyOptions {
  root: string
  version: string
  now: string
}

function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true })
}

/** Append a line to .gitignore, once. */
function ensureIgnored(root: string, lines: string[]): string[] {
  const file = path.join(root, ".gitignore")
  const existing = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : ""
  const missing = lines.filter((line) => !existing.split("\n").some((l) => l.trim() === line))
  if (missing.length === 0) return []
  const prefix = existing.length > 0 && !existing.endsWith("\n") ? "\n" : ""
  fs.writeFileSync(file, `${existing}${prefix}${missing.join("\n")}\n`)
  return missing
}

export function applyPlan(plan: InitPlan, options: ApplyOptions): Receipt {
  const created: string[] = []
  const alreadyPresent: string[] = []

  for (const dir of plan.directories) {
    const full = path.join(options.root, dir)
    if (fs.existsSync(full)) alreadyPresent.push(dir)
    else {
      ensureDir(full)
      created.push(dir)
    }
  }

  for (const file of plan.files) {
    const full = path.join(options.root, file.path)
    if (fs.existsSync(full)) {
      alreadyPresent.push(file.path)
      continue
    }
    ensureDir(path.dirname(full))
    fs.writeFileSync(full, file.contents)
    created.push(file.path)
  }

  for (const line of ensureIgnored(options.root, plan.gitignore)) created.push(`.gitignore: ${line}`)

  const receipt: Receipt = {
    version: options.version,
    installedAt: options.now,
    framework: plan.framework,
    componentDir: plan.componentDir,
    register: plan.register,
    ...(plan.styles ? { styles: plan.styles } : {}),
    typecheck: plan.typecheck,
    author: plan.author,
    created,
    alreadyPresent,
  }

  // The receipt is the config: it is what a later upgrade diffs against and
  // what uninstall reads, so nothing else has to be persisted.
  const receiptPath = path.join(options.root, ".steer/install.json")
  ensureDir(path.dirname(receiptPath))
  fs.writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`)
  return receipt
}

/** Read the filesystem through the planner's Probe shape. */
export function fsProbe(root: string) {
  return {
    exists: (rel: string) => fs.existsSync(path.join(root, rel)),
    readJson: (rel: string): Record<string, unknown> | undefined => {
      const full = path.join(root, rel)
      if (!fs.existsSync(full)) return undefined
      try {
        return JSON.parse(fs.readFileSync(full, "utf8")) as Record<string, unknown>
      } catch {
        return undefined
      }
    },
  }
}
