import path from "node:path"
import { fileURLToPath } from "node:url"
import type { Plugin, ViteDevServer } from "vite"
import { createEngine } from "../core/engine"
import type { SteerEngine } from "../ports"
import { handleSteerRequest } from "./http"
import { fsFixtures, fsManifest, fsNotes, fsSources } from "./node-fs"

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
  /** Host stylesheet imported by the bench document. */
  styles?: string
  /** "solid" (default) or "react". */
  surface?: "solid" | "react"
}

const STEER_DIR = ".steer"
const OVERLAY_ID = "virtual:steer-ui/overlay"
const BENCH_ID = "virtual:steer-ui/bench"
const OVERLAY_RESOLVED = "\0" + OVERLAY_ID
const BENCH_RESOLVED = "\0" + BENCH_ID

const here = path.dirname(fileURLToPath(import.meta.url))

function toImport(file: string): string {
  return JSON.stringify(file.split(path.sep).join("/"))
}

export function steer(options: SteerPluginOptions = {}): Plugin {
  let engine: SteerEngine
  let root = ""
  let timer: ReturnType<typeof setTimeout> | undefined
  const surface = options.surface ?? "solid"

  const regenerate = () => {
    clearTimeout(timer)
    timer = setTimeout(() => {
      engine.regenerate().catch((err) => console.error("[steer] manifest error", err))
    }, 150)
  }

  return {
    name: "steer",
    apply: "serve",

    configResolved(config) {
      root = config.root
      engine = createEngine({
        sources: fsSources(root, {
          componentDir: options.componentDir,
          extraComponentDirs: options.extraComponentDirs,
        }),
        manifestStore: fsManifest(root),
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

    resolveId(id) {
      if (id === OVERLAY_ID) return OVERLAY_RESOLVED
      if (id === BENCH_ID) return BENCH_RESOLVED
    },

    load(id) {
      if (id === OVERLAY_RESOLVED) {
        const mount = path.resolve(here, surface, "mount-overlay.tsx")
        return `import { mountOverlay } from ${toImport(mount)}\nmountOverlay()\n`
      }
      if (id === BENCH_RESOLVED) {
        const register = path.resolve(root, options.register ?? "src/steer.ts")
        const styles = path.resolve(root, options.styles ?? "src/app.css")
        const mount = path.resolve(here, surface, "mount-bench.tsx")
        return [
          `import ${toImport(styles)}`,
          `import ${toImport(register)}`,
          `import { mountBench } from ${toImport(mount)}`,
          `mountBench()`,
        ].join("\n")
      }
    },

    transformIndexHtml(_html, ctx) {
      if (ctx.path.startsWith("/__steer")) return
      if (surface !== "solid") return
      return [
        {
          tag: "script",
          attrs: { type: "module", src: `/@id/${OVERLAY_ID}` },
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
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>steer</title>
  </head>
  <body>
    <div id="steer-root"></div>
    <script type="module" src="/@id/${BENCH_ID}"></script>
  </body>
</html>`
}
