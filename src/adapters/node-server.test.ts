import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { createSteerServer, type SteerServer } from "./node-server"

// The standalone transport, exercised over a real temp host tree and real
// HTTP: the same lifecycle every other transport serves.

let root: string
let steer: SteerServer
let base: string

beforeAll(async () => {
  root = mkdtempSync(path.join(tmpdir(), "steer-server-"))
  mkdirSync(path.join(root, "src/components"), { recursive: true })
  writeFileSync(
    path.join(root, "src/components/Button.tsx"),
    `interface ButtonProps { variant?: "a" | "b" }\nexport function Button(p: ButtonProps) { return null }`
  )
  mkdirSync(path.join(root, ".steer/fixtures"), { recursive: true })
  writeFileSync(
    path.join(root, ".steer/fixtures/button.json"),
    `{ "states": { "default": { "variant": "a" } } }`
  )
  steer = createSteerServer({ root })
  const port = await steer.listen()
  base = `http://127.0.0.1:${port}`
})

afterAll(async () => {
  await steer.close()
  rmSync(root, { recursive: true, force: true })
})

describe("node-server driving adapter", () => {
  it("serves a fresh manifest with no watcher (regenerate-on-read)", async () => {
    const manifest = await fetch(`${base}/__steer/api/manifest`).then((r) => r.json())
    expect(manifest.components.map((c: { slug: string }) => c.slug)).toEqual(["button"])

    writeFileSync(
      path.join(root, "src/components/Badge.tsx"),
      `export function Badge() { return null }`
    )
    const after = await fetch(`${base}/__steer/api/manifest`).then((r) => r.json())
    expect(after.components.map((c: { slug: string }) => c.slug)).toEqual(["badge", "button"])
  })

  it("serves fixtures and the full note lifecycle over HTTP", async () => {
    const fixture = await fetch(`${base}/__steer/api/fixtures/button`).then((r) => r.json())
    expect(fixture.states.default.variant).toBe("a")

    const created = await fetch(`${base}/__steer/api/notes/button`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        stateUrl: "/__steer/button?variant=b",
        selector: "button",
        coords: { x: 0.5, y: 0.5 },
        text: "via standalone server",
        author: "agent",
      }),
    }).then((r) => r.json())
    expect(created.status).toBe("open")

    await fetch(`${base}/__steer/api/notes/button/reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: created.id, text: "ack", author: "agent" }),
    })
    const resolved = await fetch(`${base}/__steer/api/notes/button/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: created.id }),
    }).then((r) => r.json())
    expect(resolved.status).toBe("resolved")
    expect(resolved.replies).toHaveLength(1)
  })

  it("doctor answers and non-API paths get a clear 404", async () => {
    const doctor = await fetch(`${base}/__steer/api/doctor`).then((r) => r.json())
    expect(["pass", "warn"]).toContain(doctor.status)
    const miss = await fetch(`${base}/somewhere-else`)
    expect(miss.status).toBe(404)
  })
})
