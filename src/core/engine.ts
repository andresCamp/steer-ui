import type { SteerEngine, EngineDeps } from "../ports"
import { runDoctor } from "./doctor"
import { buildManifest } from "./manifest"
import { createNote, moveNoteById, replyToNoteById, resolveNoteById } from "./notes"
import type { SteerFixture, SteerManifest, SteerNote, NoteInput } from "./model"

// The engine: pure orchestration of the ports. No I/O of its own, no
// framework, no transport — an HTTP middleware, a CLI, and a test all drive
// the same object. Optional ports degrade per invariant 4: absent fixtures
// read empty, absent note storage answers undefined (transports map that to
// "notes unavailable"), never a throw.

const realClock = { now: () => new Date().toISOString() }

function randomIds() {
  return {
    id: (prefix: string) => `${prefix}_${Math.random().toString(16).slice(2, 10)}`,
  }
}

export function createEngine(deps: EngineDeps): SteerEngine {
  const clock = deps.clock ?? realClock
  const ids = deps.ids ?? randomIds()

  const rebuild = async (): Promise<SteerManifest> =>
    buildManifest({
      root: deps.sources.root(),
      generatedAt: clock.now(),
      componentFiles: await deps.sources.componentFiles(),
      scanFiles: await deps.sources.scanFiles(),
      config: deps.config,
    })

  const withNotes = async <T>(
    slug: string,
    op: (notes: SteerNote[]) => { notes: SteerNote[]; note: SteerNote } | undefined
  ): Promise<SteerNote | undefined> => {
    if (!deps.notes) return undefined
    const result = op(await deps.notes.read(slug))
    if (!result) return undefined
    await deps.notes.write(slug, result.notes)
    return result.note
  }

  return {
    async regenerate() {
      const manifest = await rebuild()
      await deps.manifestStore.write(manifest)
      return manifest
    },

    manifest: () => deps.manifestStore.read(),

    async fixture(slug): Promise<SteerFixture> {
      const raw = await deps.fixtures?.readRaw(slug)
      if (!raw) return { states: {} }
      try {
        return JSON.parse(raw) as SteerFixture
      } catch {
        return { states: {} }
      }
    },

    notes: async (slug) => (deps.notes ? deps.notes.read(slug) : []),

    addNote: (slug, input: NoteInput) =>
      withNotes(slug, (notes) => createNote(notes, slug, input, { now: clock.now, id: ids.id })),

    reply: (slug, id, text, author) =>
      withNotes(slug, (notes) =>
        replyToNoteById(notes, id, { text, author }, { now: clock.now, id: ids.id })
      ),

    resolve: (slug, id) => withNotes(slug, (notes) => resolveNoteById(notes, id)),

    move: (slug, id, coords, rect) =>
      withNotes(slug, (notes) => moveNoteById(notes, id, coords, rect)),

    async doctor() {
      const fixtures: Record<string, string> = {}
      for (const slug of (await deps.fixtures?.list()) ?? []) {
        const raw = await deps.fixtures!.readRaw(slug)
        if (raw !== undefined) fixtures[slug] = raw
      }
      const notes: Record<string, SteerNote[]> = {}
      for (const slug of (await deps.notes?.list()) ?? []) {
        notes[slug] = await deps.notes!.read(slug)
      }
      return runDoctor({
        stored: await deps.manifestStore.read(),
        rebuilt: await rebuild(),
        fixtures,
        notes,
      })
    },
  }
}
