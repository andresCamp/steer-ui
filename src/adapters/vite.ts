import path from "node:path"
import type { Plugin, ViteDevServer } from "vite"
import { createEngine } from "../core/engine"
import type { SteerEngine } from "../ports"
import { handleSteerRequest } from "./http"
import { fsFixtures, fsManifest, fsNotes, fsSources } from "./node-fs"

// The Vite driving adapter: wires the engine to a dev server. Owns the
// three things only a bundler can do — regenerate on source change, keep
// .steer/ writes from triggering reloads, and mount the shared HTTP API.
// Ports to other bundlers replace THIS file only (or use node-server.ts).

export interface SteerPluginOptions {
  componentDir?: string
  /** Directories excluded from the usage scan (where the steer UI is installed). */
  excludeDirs?: string[]
  /** Resolve imported/intersection Props types through the TS checker. */
  typecheck?: boolean
}

const STEER_DIR = ".steer"

export function steer(options: SteerPluginOptions = {}): Plugin {
  let engine: SteerEngine
  let timer: ReturnType<typeof setTimeout> | undefined

  const regenerate = () => {
    clearTimeout(timer)
    timer = setTimeout(() => {
      engine.regenerate().catch((err) => console.error("[steer] manifest error", err))
    }, 150)
  }

  return {
    name: "steer",
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
    // Notes and manifest writes land in .steer/, which is outside the module
    // graph; Vite's default for such files is a full page reload. Suppress it.
    handleHotUpdate(ctx) {
      if (ctx.file.includes(`${path.sep}${STEER_DIR}${path.sep}`)) return []
    },
    configureServer(server: ViteDevServer) {
      server.watcher.on("all", (_event, file) => {
        if (file.includes(`${path.sep}src${path.sep}`) && /\.tsx?$/.test(file)) regenerate()
      })

      server.middlewares.use(async (req, res, next) => {
        const handled = await handleSteerRequest(engine, req, res)
        if (!handled) next()
      })
    },
  }
}
