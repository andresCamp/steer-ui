import path from "node:path"
import type { IncomingMessage, ServerResponse } from "node:http"
import type { Plugin, ViteDevServer } from "vite"
import { createEngine } from "../core/engine"
import type { BenchEngine } from "../ports"
import { fsFixtures, fsManifest, fsNotes, fsSources } from "./node-fs"

// The Vite driving adapter: wires the engine to a dev server. Owns the
// three things only a bundler can do — regenerate on source change, keep
// .bench/ writes from triggering reloads, and serve the HTTP API the bench
// UI and agents share. Ports to other bundlers replace THIS file only.

export interface BenchPluginOptions {
  componentDir?: string
  /** Directories excluded from the usage scan (where the bench UI is installed). */
  excludeDirs?: string[]
}

const BENCH_DIR = ".bench"

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = ""
    req.on("data", (chunk) => (body += chunk))
    req.on("end", () => resolve(body))
    req.on("error", reject)
  })
}

function json(res: ServerResponse, status: number, data: unknown): void {
  res.statusCode = status
  res.setHeader("Content-Type", "application/json")
  res.end(JSON.stringify(data))
}

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
        if (file.includes(`${path.sep}src${path.sep}`) && file.endsWith(".tsx")) regenerate()
      })

      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url ?? "/", "http://localhost")
        if (!url.pathname.startsWith("/__bench/api/")) return next()

        try {
          if (url.pathname === "/__bench/api/manifest" && req.method === "GET") {
            const manifest = await engine.manifest()
            if (!manifest) return json(res, 503, { error: "manifest not generated yet" })
            return json(res, 200, manifest)
          }

          if (url.pathname === "/__bench/api/doctor" && req.method === "GET") {
            return json(res, 200, await engine.doctor())
          }

          const fixtureMatch = url.pathname.match(/^\/__bench\/api\/fixtures\/([a-z0-9-]+)$/)
          if (fixtureMatch && req.method === "GET") {
            return json(res, 200, await engine.fixture(fixtureMatch[1]))
          }

          const notesMatch = url.pathname.match(/^\/__bench\/api\/notes\/([a-z0-9-]+)$/)
          if (notesMatch && req.method === "GET") {
            return json(res, 200, await engine.notes(notesMatch[1]))
          }
          if (notesMatch && req.method === "POST") {
            const body = JSON.parse(await readBody(req))
            const note = await engine.addNote(notesMatch[1], body)
            if (!note) return json(res, 501, { error: "notes unavailable" })
            return json(res, 201, note)
          }

          const actionMatch = url.pathname.match(
            /^\/__bench\/api\/notes\/([a-z0-9-]+)\/(move|reply|resolve)$/
          )
          if (actionMatch && req.method === "POST") {
            const [, slug, action] = actionMatch
            const body = JSON.parse(await readBody(req))
            const note =
              action === "move"
                ? await engine.move(slug, body.id, body.coords, body.rect)
                : action === "reply"
                  ? await engine.reply(slug, body.id, body.text ?? "", body.author ?? "human")
                  : await engine.resolve(slug, body.id)
            if (!note) return json(res, 404, { error: "note not found" })
            return json(res, 200, note)
          }

          return json(res, 404, { error: "unknown bench endpoint" })
        } catch (err) {
          return json(res, 500, { error: String(err) })
        }
      })
    },
  }
}
