import type {
  BenchFixture,
  BenchManifest,
  BenchNote,
  DoctorReport,
  NoteInput,
  SourceFile,
} from "../core/model"

// The port boundary. Required minimum to run: SourceStore + ManifestStore
// (the manifest loop). FixtureStore and NoteStore are optional — absent,
// fixtures read empty and note writes report unavailable instead of
// throwing. Clock and Ids default to real implementations in the engine but
// exist as ports so benches and tests stay deterministic.

export interface SourceStore {
  /** Files under the component dir; paths relative to the host root. */
  componentFiles(): Promise<SourceFile[]>
  /** Every file eligible for the usage scan (typically all .tsx under src/). */
  scanFiles(): Promise<SourceFile[]>
  /** The host root recorded in the manifest (editor file links). */
  root(): string
}

export interface ManifestStore {
  read(): Promise<BenchManifest | undefined>
  write(manifest: BenchManifest): Promise<void>
}

export interface FixtureStore {
  /** Raw file text, so parse failures stay observable to the doctor. */
  readRaw(slug: string): Promise<string | undefined>
  list(): Promise<string[]>
}

export interface NoteStore {
  read(slug: string): Promise<BenchNote[]>
  write(slug: string, notes: BenchNote[]): Promise<void>
  list(): Promise<string[]>
}

export interface Clock {
  now(): string
}

export interface Ids {
  id(prefix: string): string
}

/** The driving port: everything a transport (HTTP middleware, CLI) can ask. */
export interface BenchEngine {
  regenerate(): Promise<BenchManifest>
  manifest(): Promise<BenchManifest | undefined>
  fixture(slug: string): Promise<BenchFixture>
  notes(slug: string): Promise<BenchNote[]>
  addNote(slug: string, input: NoteInput): Promise<BenchNote | undefined>
  reply(slug: string, id: string, text: string, author: string): Promise<BenchNote | undefined>
  resolve(slug: string, id: string): Promise<BenchNote | undefined>
  move(
    slug: string,
    id: string,
    coords: { x: number; y: number },
    rect?: { x: number; y: number; w: number; h: number }
  ): Promise<BenchNote | undefined>
  doctor(): Promise<DoctorReport>
}

export interface EngineDeps {
  sources: SourceStore
  manifestStore: ManifestStore
  fixtures?: FixtureStore
  notes?: NoteStore
  clock?: Clock
  ids?: Ids
  config?: { componentDir?: string; excludeDirs?: string[]; typecheck?: boolean }
}
