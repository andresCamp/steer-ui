import fs from "node:fs"
import path from "node:path"
import type { ServerResponse } from "node:http"
import { fileURLToPath } from "node:url"
import type { Plugin, ViteDevServer } from "vite"
import { createEngine } from "../core/engine"
import { tsxExtractor } from "../core/extract"
import { svelteExtractor } from "./extract/svelte"
import { vueExtractor } from "./extract/vue"
import type { SteerEngine } from "../ports"
import { handleSteerRequest } from "./http"
import { fsFixtures, fsManifest, fsNotes, fsSources } from "./node-fs"
import { stampComponents } from "./stamp"

// Dev-only driving adapter. `apply: "serve"` is the production guarantee:
// Vite never loads this plugin during `vite build`. The host app must not
// import steer-ui; the plugin injects the overlay and serves the bench.

export interface SteerPluginOptions {
  componentDir?: string
  /** Extra dirs to extract (repo-relative to the Vite root). */
  extraComponentDirs?: string[]
  /** Directories excluded from the usage scan (where the steer UI is installed). */
  excludeDirs?: string[]
  /** Resolve imported/intersection Props types through the TS checker. */
  typecheck?: boolean
  /** Host register module (glob). Imported only by the virtual bench entry. */
  register?: string
  /** Host stylesheet imported by the bench document, so host components look
   *  the way they do in the app. The chrome's own CSS ships with the chrome. */
  styles?: string
}

// Composition root: every language-surface reader a host might need. Core stays
// unaware of these; a TSX-only project simply has no SFCs to read.
const DEFAULT_EXTRACTORS = [tsxExtractor, vueExtractor, svelteExtractor]

const STEER_DIR = ".steer"
// The only module the HOST compiles: its stylesheet and its register entry.
// Everything else is the prebuilt chrome, served as a static asset.
const HOST_ID = "virtual:steer-ui/host"
const HOST_RESOLVED = "\0" + HOST_ID
const CHROME_ROUTE = "/__steer/chrome/"

const here = path.dirname(fileURLToPath(import.meta.url))

function toImport(file: string): string {
  return JSON.stringify(file.split(path.sep).join("/"))
}

export function steer(options: SteerPluginOptions = {}): Plugin {
  let engine: SteerEngine
  let root = ""
  let timer: ReturnType<typeof setTimeout> | undefined

  const regenerate = () => {
    clearTimeout(timer)
    timer = setTimeout(() => {
      engine.regenerate().catch((err) => console.error("[steer] manifest error", err))
    }, 150)
  }

  return {
    name: "steer",
    apply: "serve",
    // Stamp JSX before the framework compiler turns it into createComponent.
    enforce: "pre",

    configResolved(config) {
      root = config.root
      engine = createEngine({
        sources: fsSources(root, {
          componentDir: options.componentDir,
          extraComponentDirs: options.extraComponentDirs,
        }),
        manifestStore: fsManifest(root),
        extractors: DEFAULT_EXTRACTORS,
        fixtures: fsFixtures(root),
        notes: fsNotes(root),
        config: {
          componentDir: options.componentDir,
          excludeDirs: options.excludeDirs,
          typecheck: options.typecheck,
        },
      })
    },

    async buildStart() {
      await engine.regenerate()
    },

    handleHotUpdate(ctx) {
      if (ctx.file.includes(`${path.sep}${STEER_DIR}${path.sep}`)) return []
    },

    transform: {
      order: "pre",
      handler(code, id) {
        const file = id.split("?")[0] ?? id
        if (!file.endsWith(".tsx") || file.includes("node_modules")) return
        if (file.includes(`${path.sep}adapters${path.sep}`)) return
        try {
          return engine.manifest().then((manifest) => {
            const names = new Set((manifest?.components ?? []).map((c) => c.name))
            const stamped = stampComponents(code, file, names.size ? names : undefined)
            if (stamped) return { code: stamped, map: null }
          })
        } catch (err) {
          console.error("[steer] stamp failed", file, err)
        }
      },
    },

    resolveId(id) {
      if (id === HOST_ID) return HOST_RESOLVED
    },

    load(id) {
      if (id === HOST_RESOLVED) {
        const register = path.resolve(root, options.register ?? "src/steer.ts")
        const styles = path.resolve(root, options.styles ?? "src/app.css")
        return [`import ${toImport(styles)}`, `import ${toImport(register)}`].join("\n")
      }
    },

    transformIndexHtml(_html, ctx) {
      if (ctx.path.startsWith("/__steer")) return
      // Prebuilt, so it never enters the host's build. The overlay only reads
      // the host's rendered DOM, so this works in any stack.
      return [
        {
          tag: "link",
          attrs: { rel: "stylesheet", href: `${CHROME_ROUTE}overlay.css` },
          injectTo: "head",
        },
        {
          tag: "script",
          attrs: { type: "module", src: `${CHROME_ROUTE}overlay.js` },
          injectTo: "body",
        },
      ]
    },

    configureServer(server: ViteDevServer) {
      server.watcher.on("all", (_event, file) => {
        if (file.includes(`${path.sep}src${path.sep}`) && /\.tsx?$/.test(file)) regenerate()
      })

      server.middlewares.use(async (req, res, next) => {
        const url = req.url ?? ""
        const pathname = url.split("?")[0] ?? ""

        if (pathname.startsWith(CHROME_ROUTE)) {
          const served = await serveChrome(pathname, res)
          if (served) return
        }

        if (isBenchPage(pathname)) {
          const raw = benchHtml()
          const html = await server.transformIndexHtml("/__steer/index.html", raw)
          res.setHeader("Content-Type", "text/html")
          res.end(html)
          return
        }

        const handled = await handleSteerRequest(engine, req, res)
        if (!handled) next()
      })
    },
  }
}

function isBenchPage(pathname: string): boolean {
  if (pathname.startsWith("/__steer/api")) return false
  return pathname === "/__steer" || pathname.startsWith("/__steer/")
}

function benchHtml(): string {
  // Two module graphs meeting in one document. The host entry is compiled by
  // the host (it needs the host's resolution and HMR for the component glob);
  // the chrome is a prebuilt asset the host never parses. Load order does not
  // matter: the bridge queues whichever arrives first.
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>steer</title>
    <link rel="stylesheet" href="${CHROME_ROUTE}bench.css" />
  </head>
  <body>
    <div id="steer-root"></div>
    <script type="module" src="/@id/${HOST_ID}"></script>
    <script type="module" src="${CHROME_ROUTE}bench.js"></script>
  </body>
</html>`
}

const CHROME_TYPES: Record<string, string> = {
  ".js": "text/javascript",
  ".css": "text/css",
  ".map": "application/json",
}

/** Where the BUILT chrome sits: dist/chrome next to the plugin once published,
 *  or at the repo root while working in the lab. Probing for the built entry
 *  rather than the directory matters in the lab, where the plugin sits beside
 *  the chrome's SOURCE directory and would otherwise match it. */
function chromeDir(): string | undefined {
  const candidates = [
    path.resolve(here, "chrome"),
    path.resolve(here, "../../dist/chrome"),
    path.resolve(here, "../../../dist/chrome"),
  ]
  return candidates.find((dir) => fs.existsSync(path.join(dir, "bench.js")))
}

async function serveChrome(pathname: string, res: ServerResponse): Promise<boolean> {
  const dir = chromeDir()
  const name = pathname.slice(CHROME_ROUTE.length)
  // Invariant 4: an unbuilt chrome is a blank bench, so say so out loud.
  if (!dir) {
    console.error("[steer] chrome not built. Run `pnpm build:chrome`.")
    return false
  }
  const file = path.resolve(dir, name)
  if (!file.startsWith(dir) || !fs.existsSync(file)) return false
  res.setHeader("Content-Type", CHROME_TYPES[path.extname(file)] ?? "application/octet-stream")
  res.end(await fs.promises.readFile(file))
  return true
}
