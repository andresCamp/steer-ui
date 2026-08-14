import type { SteerNote, NoteInput } from "./model"

// Note operations: pure transitions over a component's note list. Every
// operation returns a NEW list — the engine never deletes a note or reply,
// and resolution is a status flip (invariant 3). Time and identity are
// injected so every transition is deterministic under test.

/** The selector a note carries when it landed on the bench, not an element. */
/** Marks a chrome mount point. Excluded from note anchors: it is our
 *  scaffolding, not part of the host component. */
export const SLOT_ATTR = "data-steer-slot"

export const SURFACE_SELECTOR = "(bench)"

/** What that selector was called before the surface was named "bench". */
const LEGACY_SURFACE_SELECTOR = "(stage)"

/**
 * Read-time backfill for notes written under the old vocabulary. Stores call
 * this on the way out, so a repo whose .steer/notes predate the rename reads
 * back in today's terms without a migration step the host has to run.
 */
export function migrateNotes(notes: SteerNote[]): SteerNote[] {
  return notes.map((n) =>
    n.selector === LEGACY_SURFACE_SELECTOR ? { ...n, selector: SURFACE_SELECTOR } : n
  )
}

export interface NoteContext {
  now(): string
  id(prefix: string): string
}

export function createNote(
  notes: SteerNote[],
  component: string,
  input: NoteInput,
  ctx: NoteContext
): { notes: SteerNote[]; note: SteerNote } {
  const note: SteerNote = {
    id: ctx.id("note"),
    component,
    stateUrl: input.stateUrl ?? "",
    selector: input.selector ?? "",
    coords: input.coords ?? { x: 0.5, y: 0.5 },
    ...(input.rect !== undefined ? { rect: input.rect } : {}),
    text: input.text ?? "",
    author: input.author ?? "human",
    status: "open",
    created: ctx.now(),
  }
  return { notes: [...notes, note], note }
}

export function replyToNoteById(
  notes: SteerNote[],
  id: string,
  reply: { text: string; author: string },
  ctx: NoteContext
): { notes: SteerNote[]; note: SteerNote } | undefined {
  const existing = notes.find((n) => n.id === id)
  if (!existing) return undefined
  const updated: SteerNote = {
    ...existing,
    replies: [
      ...(existing.replies ?? []),
      {
        id: ctx.id("reply"),
        author: reply.author ?? "human",
        text: reply.text ?? "",
        created: ctx.now(),
      },
    ],
  }
  return { notes: notes.map((n) => (n.id === id ? updated : n)), note: updated }
}

export function resolveNoteById(
  notes: SteerNote[],
  id: string
): { notes: SteerNote[]; note: SteerNote } | undefined {
  const existing = notes.find((n) => n.id === id)
  if (!existing) return undefined
  const updated: SteerNote = { ...existing, status: "resolved" }
  return { notes: notes.map((n) => (n.id === id ? updated : n)), note: updated }
}

export function moveNoteById(
  notes: SteerNote[],
  id: string,
  coords: { x: number; y: number },
  rect?: { x: number; y: number; w: number; h: number }
): { notes: SteerNote[]; note: SteerNote } | undefined {
  const existing = notes.find((n) => n.id === id)
  if (!existing) return undefined
  // A move without a rect leaves an existing region in place; passing a
  // rect (from a region drag/resize) replaces it.
  const updated: SteerNote = {
    ...existing,
    coords,
    ...(rect !== undefined ? { rect } : {}),
  }
  return { notes: notes.map((n) => (n.id === id ? updated : n)), note: updated }
}
