import { describe, expect, it } from "vitest"
import type { BenchNote } from "./model"
import { createNote, moveNoteById, replyToNoteById, resolveNoteById, type NoteContext } from "./notes"

const ctx = (): NoteContext => {
  let clock = 0
  let ids = 0
  return { now: () => `2026-01-01T00:00:0${clock++}.000Z`, id: (p) => `${p}_${++ids}` }
}

const seed = (): BenchNote[] => {
  const { notes } = createNote(
    [],
    "button",
    {
      stateUrl: "/__bench/button?variant=ghost",
      selector: "button",
      coords: { x: 0.5, y: 0.5 },
      rect: { x: 0.1, y: 0.1, w: 0.4, h: 0.2 },
      text: "first",
      author: "andres",
    },
    ctx()
  )
  return notes
}

describe("note transitions (invariant 3: append-preserving)", () => {
  it("creates an open note with injected identity and time", () => {
    const notes = seed()
    expect(notes).toHaveLength(1)
    expect(notes[0]).toMatchObject({
      id: "note_1",
      component: "button",
      status: "open",
      author: "andres",
      created: "2026-01-01T00:00:00.000Z",
    })
  })

  it("replies append and never replace", () => {
    const c = ctx()
    let notes = seed()
    notes = replyToNoteById(notes, "note_1", { text: "one", author: "agent" }, c)!.notes
    notes = replyToNoteById(notes, "note_1", { text: "two", author: "andres" }, c)!.notes
    expect(notes[0].replies!.map((r) => r.text)).toEqual(["one", "two"])
    expect(notes[0].text).toBe("first")
  })

  it("resolution is a status flip, not a deletion", () => {
    const notes = seed()
    const result = resolveNoteById(notes, "note_1")!
    expect(result.notes).toHaveLength(1)
    expect(result.note.status).toBe("resolved")
    expect(result.note.text).toBe("first")
    expect(result.note.replies).toEqual(notes[0].replies)
  })

  it("a move without a rect keeps the existing region", () => {
    const notes = seed()
    const moved = moveNoteById(notes, "note_1", { x: 0.9, y: 0.9 })!
    expect(moved.note.coords).toEqual({ x: 0.9, y: 0.9 })
    expect(moved.note.rect).toEqual({ x: 0.1, y: 0.1, w: 0.4, h: 0.2 })
    const reshaped = moveNoteById(notes, "note_1", { x: 0.5, y: 0.1 }, { x: 0.1, y: 0.1, w: 0.4, h: 0.5 })!
    expect(reshaped.note.rect!.h).toBe(0.5)
  })

  it("unknown ids answer undefined instead of throwing (invariant 4)", () => {
    const c = ctx()
    expect(replyToNoteById([], "missing", { text: "x", author: "a" }, c)).toBeUndefined()
    expect(resolveNoteById([], "missing")).toBeUndefined()
    expect(moveNoteById([], "missing", { x: 0, y: 0 })).toBeUndefined()
  })

  it("operations return new arrays; inputs are never mutated", () => {
    const notes = seed()
    const frozen = JSON.stringify(notes)
    resolveNoteById(notes, "note_1")
    moveNoteById(notes, "note_1", { x: 0, y: 0 })
    replyToNoteById(notes, "note_1", { text: "x", author: "a" }, ctx())
    expect(JSON.stringify(notes)).toBe(frozen)
  })
})
