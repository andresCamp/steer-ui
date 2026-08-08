import path from "node:path"
import type { Plugin, ViteDevServer } from "vite"
import { createEngine } from "../core/engine"
import type { BenchEngine } from "../ports"
import { handleBenchRequest } from "./http"
import { fsFixtures, fsManifest, fsNotes, fsSources } from "./node-fs"

// The Vite driving adapter: wires the engine to a dev server. Owns the
// three things only a bundler can do — regenerate on source change, keep
// .bench/ writes from triggering reloads, and mount the shared HTTP API.
// Ports to other bundlers replace THIS file only (or use node-server.ts).

export interface BenchPluginOptions {
  componentDir?: string
  /** Directories excluded from the usage scan (where the bench UI is installed). */
  excludeDirs?: string[]
  /** Resolve imported/intersection Props types through the TS checker. */
  typecheck?: boolean
}

const BENCH_DIR = ".bench"

export function bench(options: BenchPluginOptions = {}): Plugin {
  let engine: BenchEngine
  let timer: ReturnType<typeof setTimeout> | undefined

  const regenerate = () => {
    clearTimeout(timer)
    timer = setTimeout(() => {
      engine.regenerate().catch((err) => console.error("[bench] manifest error", err))
    }, 150)
  }

  return {
    name: "bench",
    configResolved(config) {
      const root = config.root
      engine = createEngine({
        sources: fsSources(root, { componentDir: options.componentDir }),
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
    // Notes and manifest writes land in .bench/, which is outside the module
    // graph; Vite's default for such files is a full page reload. Suppress it.
    handleHotUpdate(ctx) {
      if (ctx.file.includes(`${path.sep}${BENCH_DIR}${path.sep}`)) return []
    },
    configureServer(server: ViteDevServer) {
      server.watcher.on("all", (_event, file) => {
        if (file.includes(`${path.sep}src${path.sep}`) && /\.tsx?$/.test(file)) regenerate()
      })

      server.middlewares.use(async (req, res, next) => {
        const handled = await handleBenchRequest(engine, req, res)
        if (!handled) next()
      })
    },
  }
}
