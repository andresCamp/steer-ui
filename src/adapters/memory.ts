import type {
  Clock,
  FixtureStore,
  Ids,
  ManifestStore,
  NoteStore,
  SourceStore,
} from "../ports"
import type { BenchManifest, BenchNote, SourceFile } from "../core/model"

// In-memory implementations of every port: bench and test fuel. Each store
// exposes inspection helpers so tests read state without side channels.

export function memorySources(root: string, files: SourceFile[], componentDir = "src/components") {
  const store: SourceStore = {
    componentFiles: async () => files.filter((f) => f.path.startsWith(componentDir)),
    scanFiles: async () => files.filter((f) => f.path.endsWith(".tsx")),
    root: () => root,
  }
  return store
}

export function memoryManifest(initial?: BenchManifest) {
  let stored = initial
  const store: ManifestStore & { current(): BenchManifest | undefined } = {
    read: async () => stored,
    write: async (manifest) => {
      stored = manifest
    },
    current: () => stored,
  }
  return store
}

export function memoryFixtures(fixtures: Record<string, string> = {}) {
  const store: FixtureStore & { set(slug: string, raw: string): void } = {
    readRaw: async (slug) => fixtures[slug],
    list: async () => Object.keys(fixtures),
    set: (slug, raw) => {
      fixtures[slug] = raw
    },
  }
  return store
}

export function memoryNotes(initial: Record<string, BenchNote[]> = {}) {
  const notes: Record<string, BenchNote[]> = { ...initial }
  const store: NoteStore & { all(): Record<string, BenchNote[]> } = {
    read: async (slug) => notes[slug] ?? [],
    write: async (slug, next) => {
      notes[slug] = next
    },
    list: async () => Object.keys(notes),
    all: () => notes,
  }
  return store
}

/** Advances a fixed amount per read so created/reply timestamps stay ordered. */
export function fixedClock(startIso = "2026-01-01T00:00:00.000Z", stepMs = 1000): Clock {
  let tick = 0
  return {
    now: () => new Date(new Date(startIso).getTime() + tick++ * stepMs).toISOString(),
  }
}

export function seqIds(): Ids {
  let n = 0
  return { id: (prefix) => `${prefix}_${String(++n).padStart(4, "0")}` }
}
