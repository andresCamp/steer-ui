import type { BenchFixture, BenchManifest, BenchNote, DoctorReport } from "../core/model"

// Framework-neutral browser client: the HTTP API calls and the DOM selector
// builder every render surface shares. No framework imports here; the
// per-framework data modules re-export this and add only their registry and
// element rendering.

export const fetchManifest = (): Promise<BenchManifest> =>
  fetch("/__bench/api/manifest").then((r) => r.json())

export const fetchFixture = (slug: string): Promise<BenchFixture> =>
  fetch(`/__bench/api/fixtures/${slug}`).then((r) => r.json())

export const fetchNotes = (slug: string): Promise<BenchNote[]> =>
  fetch(`/__bench/api/notes/${slug}`).then((r) => r.json())

export const fetchDoctor = (): Promise<DoctorReport> =>
  fetch("/__bench/api/doctor").then((r) => r.json())

export const postNote = (
  slug: string,
  note: Pick<BenchNote, "stateUrl" | "selector" | "coords" | "rect" | "text" | "author">
): Promise<BenchNote> =>
  fetch(`/__bench/api/notes/${slug}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(note),
  }).then((r) => r.json())

export const moveNote = (
  slug: string,
  id: string,
  coords: { x: number; y: number },
  rect?: { x: number; y: number; w: number; h: number }
): Promise<BenchNote> =>
  fetch(`/__bench/api/notes/${slug}/move`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, coords, rect }),
  }).then((r) => r.json())

export const replyNote = (
  slug: string,
  id: string,
  text: string,
  author: string
): Promise<BenchNote> =>
  fetch(`/__bench/api/notes/${slug}/reply`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, text, author }),
  }).then((r) => r.json())

export const resolveNote = (slug: string, id: string): Promise<BenchNote> =>
  fetch(`/__bench/api/notes/${slug}/resolve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  }).then((r) => r.json())

/** Build a CSS selector for an element, scoped to the bench stage. */
export function selectorWithin(stage: HTMLElement, target: HTMLElement): string {
  const parts: string[] = []
  let el: HTMLElement | null = target
  while (el && el !== stage) {
    const tag = el.tagName.toLowerCase()
    const parent: HTMLElement | null = el.parentElement
    let part = tag
    if (parent) {
      const siblings = Array.from(parent.children).filter(
        (c) => c.tagName === el!.tagName
      )
      if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(el) + 1})`
    }
    parts.unshift(part)
    el = parent
  }
  return parts.join(" > ") || "(stage)"
}
