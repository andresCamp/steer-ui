import { createServer, type Server } from "node:http"
import { createEngine } from "../core/engine"
import { tsxExtractor } from "../core/extract"
import { svelteExtractor } from "./extract/svelte"
import { vueExtractor } from "./extract/vue"
import type { SteerEngine } from "../ports"
import { handleSteerRequest } from "./http"
import { fsFixtures, fsManifest, fsNotes, fsSources } from "./node-fs"

// Composition root: every language-surface reader a host might need. Core stays
// unaware of these; a TSX-only project simply has no SFCs to read.
const DEFAULT_EXTRACTORS = [tsxExtractor, vueExtractor, svelteExtractor]


// The framework-neutral driving adapter: a standalone dev API server for
// hosts whose dev server is not Vite (Next, webpack, express, anything).
// The host proxies /__steer/api/* here (Next `rewrites`, Vite
// `server.proxy`, express `http-proxy-middleware`) and mounts the render
// surface on its own routes. No file watcher: manifest and doctor reads
// regenerate on request, so answers are always fresh and the adapter stays
// dependency-free. Notes/fixtures writes land in the same .steer/ files as
// every other transport.

export interface SteerServerOptions {
  /** Host project root (where .steer/ and the source tree live). */
  root: string
  port?: number
  componentDir?: string
  excludeDirs?: string[]
  typecheck?: boolean
}

export interface SteerServer {
  engine: SteerEngine
  server: Server
  /** Start listening; resolves with the bound port. */
  listen(): Promise<number>
  close(): Promise<void>
}

export function createSteerServer(options: SteerServerOptions): SteerServer {
  const engine = createEngine({
    sources: fsSources(options.root, { componentDir: options.componentDir }),
    manifestStore: fsManifest(options.root),
    extractors: DEFAULT_EXTRACTORS,
    fixtures: fsFixtures(options.root),
    notes: fsNotes(options.root),
    config: {
      componentDir: options.componentDir,
      excludeDirs: options.excludeDirs,
      typecheck: options.typecheck,
    },
  })

  const server = createServer(async (req, res) => {
    const handled = await handleSteerRequest(engine, req, res, { regenerateOnRead: true })
    if (!handled) {
      res.statusCode = 404
      res.setHeader("Content-Type", "application/json")
      res.end(JSON.stringify({ error: "steer API server: unknown path" }))
    }
  })

  return {
    engine,
    server,
    listen: () =>
      new Promise((resolve, reject) => {
        server.once("error", reject)
        server.listen(options.port ?? 0, () => {
          const address = server.address()
          resolve(typeof address === "object" && address ? address.port : (options.port ?? 0))
        })
      }),
    close: () =>
      new Promise((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve()))
      ),
  }
}
