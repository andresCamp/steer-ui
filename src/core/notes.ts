import type { BenchNote, NoteInput } from "./model"

// Note operations: pure transitions over a component's note list. Every
// operation returns a NEW list — the engine never deletes a note or reply,
// and resolution is a status flip (invariant 3). Time and identity are
// injected so every transition is deterministic under test.

export interface NoteContext {
  now(): string
  id(prefix: string): string
}

export function createNote(
  notes: BenchNote[],
  component: string,
  input: NoteInput,
  ctx: NoteContext
): { notes: BenchNote[]; note: BenchNote } {
  const note: BenchNote = {
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
  notes: BenchNote[],
  id: string,
  reply: { text: string; author: string },
  ctx: NoteContext
): { notes: BenchNote[]; note: BenchNote } | undefined {
  const existing = notes.find((n) => n.id === id)
  if (!existing) return undefined
  const updated: BenchNote = {
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
  notes: BenchNote[],
  id: string
): { notes: BenchNote[]; note: BenchNote } | undefined {
  const existing = notes.find((n) => n.id === id)
  if (!existing) return undefined
  const updated: BenchNote = { ...existing, status: "resolved" }
  return { notes: notes.map((n) => (n.id === id ? updated : n)), note: updated }
}

export function moveNoteById(
  notes: BenchNote[],
  id: string,
  coords: { x: number; y: number },
  rect?: { x: number; y: number; w: number; h: number }
): { notes: BenchNote[]; note: BenchNote } | undefined {
  const existing = notes.find((n) => n.id === id)
  if (!existing) return undefined
  // A move without a rect leaves an existing region in place; passing a
  // rect (from a region drag/resize) replaces it.
  const updated: BenchNote = {
    ...existing,
    coords,
    ...(rect !== undefined ? { rect } : {}),
  }
  return { notes: notes.map((n) => (n.id === id ? updated : n)), note: updated }
}
