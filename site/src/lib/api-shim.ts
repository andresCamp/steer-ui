import type { SteerNote } from "../../../src/core/model"

/**
 * The steer API, without a dev server behind it.
 *
 * GETs fall through to the static files the build wrote under
 * /__steer/api/*. Writes have nowhere to go on a static site, so they are
 * applied here and kept in localStorage, which is the one honest difference
 * between this bench and the one in your repo.
 */

const KEY = "steerui:bench-notes"
const API = "/__steer/api/"

type NoteMap = Record<string, SteerNote[]>

function read(): NoteMap {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") as NoteMap
  } catch {
    return {}
  }
}

function write(map: NoteMap) {
  try {
    localStorage.setItem(KEY, JSON.stringify(map))
  } catch {
    /* blocked storage degrades to a session, never a crash */
  }
}

const json = (value: unknown) =>
  new Response(JSON.stringify(value), { headers: { "Content-Type": "application/json" } })

let installed = false

export function installApiShim() {
  if (installed || typeof window === "undefined") return
  installed = true

  const original = window.fetch.bind(window)

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url
    const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase()

    if (!url.includes(API)) return original(input as RequestInfo, init)

    const path = url.slice(url.indexOf(API) + API.length)
    const [section, slug, action] = path.split("/")

    if (section !== "notes") return original(input as RequestInfo, init)

    const map = read()
    const stored = map[slug]

    // First read of a component merges the notes the build shipped with it.
    if (!stored) {
      const seeded = await original(`${API}notes/${slug}`)
        .then((r) => (r.ok ? (r.json() as Promise<SteerNote[]>) : []))
        .catch(() => [] as SteerNote[])
      map[slug] = seeded
      write(map)
    }

    const notes = () => read()[slug] ?? []
    const save = (next: SteerNote[]) => {
      const m = read()
      m[slug] = next
      write(m)
    }

    if (method === "GET") return json(notes())

    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, any>) : {}

    if (!action) {
      const note: SteerNote = {
        id: `n${Date.now().toString(36)}`,
        component: slug,
        stateUrl: body.stateUrl,
        selector: body.selector,
        coords: body.coords,
        ...(body.rect ? { rect: body.rect } : {}),
        text: body.text,
        author: body.author ?? "human",
        status: "open",
        created: new Date().toISOString(),
        replies: [],
      }
      save([...notes(), note])
      return json(note)
    }

    let updated: SteerNote | undefined
    const next = notes().map((n) => {
      if (n.id !== body.id) return n
      if (action === "move") updated = { ...n, coords: body.coords, ...(body.rect ? { rect: body.rect } : {}) }
      else if (action === "resolve") updated = { ...n, status: "resolved" as const }
      else if (action === "reply")
        updated = {
          ...n,
          replies: [
            ...(n.replies ?? []),
            { id: `r${Date.now().toString(36)}`, author: body.author ?? "human", text: body.text, created: new Date().toISOString() },
          ],
        }
      return updated ?? n
    })
    save(next)
    return updated ? json(updated) : new Response("not found", { status: 404 })
  }
}

installApiShim()
