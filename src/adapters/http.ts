import type { IncomingMessage, ServerResponse } from "node:http"
import type { BenchEngine } from "../ports"

// The HTTP surface of the engine, transport-agnostic: one handler any node
// server can mount (Vite middleware, the standalone server, an express
// route). Owning the route table in one place keeps the API identical
// across transports (invariant 5).

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

export interface BenchRequestOptions {
  /**
   * Regenerate before answering manifest/doctor reads. Transports without a
   * file watcher (the standalone server) set this so reads are always fresh;
   * watched transports (Vite) leave it off.
   */
  regenerateOnRead?: boolean
}

/**
 * Handle one request against the bench API. Returns false (without touching
 * the response) when the URL is not a bench API route, so callers can fall
 * through to their own handling.
 */
export async function handleBenchRequest(
  engine: BenchEngine,
  req: IncomingMessage,
  res: ServerResponse,
  options: BenchRequestOptions = {}
): Promise<boolean> {
  const url = new URL(req.url ?? "/", "http://localhost")
  if (!url.pathname.startsWith("/__bench/api/")) return false

  try {
    if (url.pathname === "/__bench/api/manifest" && req.method === "GET") {
      if (options.regenerateOnRead) await engine.regenerate()
      const manifest = await engine.manifest()
      if (!manifest) json(res, 503, { error: "manifest not generated yet" })
      else json(res, 200, manifest)
      return true
    }

    if (url.pathname === "/__bench/api/doctor" && req.method === "GET") {
      if (options.regenerateOnRead) await engine.regenerate()
      json(res, 200, await engine.doctor())
      return true
    }

    const fixtureMatch = url.pathname.match(/^\/__bench\/api\/fixtures\/([a-z0-9-]+)$/)
    if (fixtureMatch && req.method === "GET") {
      json(res, 200, await engine.fixture(fixtureMatch[1]))
      return true
    }

    const notesMatch = url.pathname.match(/^\/__bench\/api\/notes\/([a-z0-9-]+)$/)
    if (notesMatch && req.method === "GET") {
      json(res, 200, await engine.notes(notesMatch[1]))
      return true
    }
    if (notesMatch && req.method === "POST") {
      const body = JSON.parse(await readBody(req))
      const note = await engine.addNote(notesMatch[1], body)
      if (!note) json(res, 501, { error: "notes unavailable" })
      else json(res, 201, note)
      return true
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
      if (!note) json(res, 404, { error: "note not found" })
      else json(res, 200, note)
      return true
    }

    json(res, 404, { error: "unknown bench endpoint" })
    return true
  } catch (err) {
    json(res, 500, { error: String(err) })
    return true
  }
}
