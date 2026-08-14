// What `steer-ui init` will do, worked out before anything is written.
//
// This is deliberately pure: it reads through a Probe rather than the disk, so
// every detection rule and every refusal is unit testable. Installing into
// someone else's repo is the one place a mistake is expensive, and prose
// recipes cannot be tested.
//
// The split with the agent: this decides and writes the mechanical parts, and
// it NEVER edits the bundler config. That file is arbitrary (defineConfig
// callbacks, conditionals, spread plugin arrays, generated configs) and
// AST-editing it is where a tool starts damaging real projects. It returns the
// snippet instead, and the agent places it.

export type Framework = "solid" | "react" | "vue" | "svelte"

export interface Probe {
  exists(rel: string): boolean
  readJson(rel: string): Record<string, unknown> | undefined
}

export interface InitOptions {
  framework?: Framework
  componentDir?: string
  register?: string
  styles?: string
  typecheck?: boolean
  author?: string
  now?: string
}

export interface PlannedFile {
  path: string
  contents: string
  /** Shown when the file already exists, so a re-run explains itself. */
  reason: string
}

export interface InitPlan {
  framework: Framework
  componentDir: string
  register: string
  styles?: string
  typecheck: boolean
  author: string
  files: PlannedFile[]
  directories: string[]
  gitignore: string[]
  /** The one edit the agent must make, because the CLI will not touch it. */
  snippet: string
  notes: string[]
}

export interface InitRefusal {
  problem: string
  /** The flag that would resolve it, so an agent can correct and re-run. */
  fix: string
}

export type InitResult = { ok: true; plan: InitPlan } | { ok: false; refusal: InitRefusal }

const EXTENSION: Record<Framework, string> = {
  solid: "tsx",
  react: "tsx",
  vue: "vue",
  svelte: "svelte",
}

const MOUNTER: Record<Framework, { name: string; from: string }> = {
  solid: { name: "solidMounter", from: "steer-ui/mount/solid" },
  react: { name: "reactMounter", from: "steer-ui/mount/react" },
  vue: { name: "vueMounter", from: "steer-ui/mount/vue" },
  svelte: { name: "svelteMounter", from: "steer-ui/mount/svelte" },
}

/** Ordered: the first dependency found wins, so a React app that also pulls in
 *  solid-js transitively is not mistaken for a Solid app. */
const BY_DEPENDENCY: [string, Framework][] = [
  ["solid-js", "solid"],
  ["vue", "vue"],
  ["svelte", "svelte"],
  ["react", "react"],
]

const COMPONENT_DIRS = [
  "src/components",
  "app/components",
  "src/lib/components",
  "src/ui",
  "app/ui",
  "components",
  "lib/components",
]

const STYLESHEETS = [
  "src/app.css",
  "src/index.css",
  "src/main.css",
  "src/styles/global.css",
  "src/styles/globals.css",
  "app/globals.css",
]

function detectFramework(probe: Probe): Framework | undefined {
  const pkg = probe.readJson("package.json")
  if (!pkg) return undefined
  const deps = {
    ...(pkg.dependencies as Record<string, string> | undefined),
    ...(pkg.devDependencies as Record<string, string> | undefined),
  }
  for (const [dep, framework] of BY_DEPENDENCY) if (deps[dep]) return framework
  return undefined
}

function parentOf(dir: string): string {
  const parts = dir.split("/")
  return parts.length > 1 ? parts.slice(0, -1).join("/") : ""
}

function registerTemplate(framework: Framework, componentDir: string, register: string, author: string): string {
  const mounter = MOUNTER[framework]
  const base = parentOf(register)
  const relative = base && componentDir.startsWith(`${base}/`) ? componentDir.slice(base.length + 1) : componentDir
  const glob = `./${relative}/**/*.${EXTENSION[framework]}`
  return `import { publishRegistration } from "steer-ui/bridge"
import { ${mounter.name} } from "${mounter.from}"

// Written by \`steer-ui init\`.
//
// This file is imported only by steer-ui's own bench entry, never by the app.
// If something in the app imports it, the bench ships to production, which is
// a bug rather than a preference.
//
// The glob has to live here because import.meta.glob resolves relative to the
// file that calls it, and the mounter rides along because instantiating one of
// your components is the single thing the prebuilt bench cannot do for itself.

publishRegistration(globalThis, {
  modules: import.meta.glob("${glob}", { eager: true }) as Record<
    string,
    Record<string, unknown>
  >,
  mounter: ${mounter.name},
  author: ${JSON.stringify(author)},
})
`
}

function pluginSnippet(plan: Omit<InitPlan, "snippet" | "files" | "directories" | "gitignore" | "notes">): string {
  const options = [
    `componentDir: ${JSON.stringify(plan.componentDir)}`,
    `register: ${JSON.stringify(plan.register)}`,
    ...(plan.styles ? [`styles: ${JSON.stringify(plan.styles)}`] : []),
    ...(plan.typecheck ? ["typecheck: true"] : []),
  ]
  return `import { steer } from "steer-ui/vite"

// add to plugins, after your framework plugin
steer({ ${options.join(", ")} })`
}

export function planInit(probe: Probe, options: InitOptions = {}): InitResult {
  if (!probe.readJson("package.json")) {
    return {
      ok: false,
      refusal: {
        problem: "no package.json here, so this is not a JavaScript project root",
        fix: "run init from the project root, or pass --root <dir>",
      },
    }
  }

  const framework = options.framework ?? detectFramework(probe)
  if (!framework) {
    return {
      ok: false,
      refusal: {
        problem: "could not tell which framework this project uses",
        fix: "pass --framework solid|react|vue|svelte",
      },
    }
  }

  const componentDir = options.componentDir ?? COMPONENT_DIRS.find((dir) => probe.exists(dir))
  if (!componentDir) {
    return {
      ok: false,
      refusal: {
        problem: `looked for components in ${COMPONENT_DIRS.join(", ")} and found none`,
        fix: "pass --components <dir>",
      },
    }
  }
  if (!probe.exists(componentDir)) {
    return {
      ok: false,
      refusal: { problem: `--components ${componentDir} does not exist`, fix: "pass a directory that does" },
    }
  }

  const styles = options.styles ?? STYLESHEETS.find((file) => probe.exists(file))
  if (options.styles && !probe.exists(options.styles)) {
    return {
      ok: false,
      refusal: { problem: `--styles ${options.styles} does not exist`, fix: "pass a stylesheet that does" },
    }
  }

  const parent = parentOf(componentDir)
  const register = options.register ?? (parent ? `${parent}/steer.ts` : "steer.ts")
  const author = options.author ?? "human"
  const typecheck = options.typecheck ?? false

  const notes: string[] = []
  if (!styles) {
    notes.push(
      "no host stylesheet found, so your components will render in the bench without the app's own CSS. Pass --styles if it lives somewhere unusual.",
    )
  }

  const base = { framework, componentDir, register, styles, typecheck, author }

  return {
    ok: true,
    plan: {
      ...base,
      files: [
        {
          path: register,
          contents: registerTemplate(framework, componentDir, register, author),
          reason: "the component glob and the mounter, the only part of steer-ui your app compiles",
        },
      ],
      directories: [".steer/fixtures", ".steer/notes"],
      gitignore: [".steer/manifest.json"],
      snippet: pluginSnippet(base),
      notes,
    },
  }
}
