import type { SteerFixture, SteerManifest, SteerNote, DoctorReport } from "../core/model"
import { SURFACE_SELECTOR } from "../core/notes"

// Framework-neutral browser client: the HTTP API calls and the DOM selector
// builder every render surface shares. No framework imports here; the
// per-framework data modules re-export this and add only their registry and
// element rendering.

export const fetchManifest = (): Promise<SteerManifest> =>
  fetch("/__steer/api/manifest").then((r) => r.json())

export const fetchFixture = (slug: string): Promise<SteerFixture> =>
  fetch(`/__steer/api/fixtures/${slug}`).then((r) => r.json())

export const fetchNotes = (slug: string): Promise<SteerNote[]> =>
  fetch(`/__steer/api/notes/${slug}`).then((r) => r.json())

export const fetchDoctor = (): Promise<DoctorReport> =>
  fetch("/__steer/api/doctor").then((r) => r.json())

export const postNote = (
  slug: string,
  note: Pick<SteerNote, "stateUrl" | "selector" | "coords" | "rect" | "text" | "author">
): Promise<SteerNote> =>
  fetch(`/__steer/api/notes/${slug}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(note),
  }).then((r) => r.json())

export const moveNote = (
  slug: string,
  id: string,
  coords: { x: number; y: number },
  rect?: { x: number; y: number; w: number; h: number }
): Promise<SteerNote> =>
  fetch(`/__steer/api/notes/${slug}/move`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, coords, rect }),
  }).then((r) => r.json())

export const replyNote = (
  slug: string,
  id: string,
  text: string,
  author: string
): Promise<SteerNote> =>
  fetch(`/__steer/api/notes/${slug}/reply`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, text, author }),
  }).then((r) => r.json())

export const resolveNote = (slug: string, id: string): Promise<SteerNote> =>
  fetch(`/__steer/api/notes/${slug}/resolve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  }).then((r) => r.json())

/** Build a CSS selector for an element, scoped to the steer bench. */
export function selectorWithin(bench: HTMLElement, target: HTMLElement): string {
  const parts: string[] = []
  let el: HTMLElement | null = target
  while (el && el !== bench) {
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
  return parts.join(" > ") || SURFACE_SELECTOR
}
