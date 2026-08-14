import type {
  SteerFixture,
  SteerManifest,
  SteerNote,
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
  read(): Promise<SteerManifest | undefined>
  write(manifest: SteerManifest): Promise<void>
}

export interface FixtureStore {
  /** Raw file text, so parse failures stay observable to the doctor. */
  readRaw(slug: string): Promise<string | undefined>
  list(): Promise<string[]>
}

export interface NoteStore {
  read(slug: string): Promise<SteerNote[]>
  write(slug: string, notes: SteerNote[]): Promise<void>
  list(): Promise<string[]>
}

export interface Clock {
  now(): string
}

export interface Ids {
  id(prefix: string): string
}

/** The driving port: everything a transport (HTTP middleware, CLI) can ask. */
export interface SteerEngine {
  regenerate(): Promise<SteerManifest>
  manifest(): Promise<SteerManifest | undefined>
  fixture(slug: string): Promise<SteerFixture>
  notes(slug: string): Promise<SteerNote[]>
  addNote(slug: string, input: NoteInput): Promise<SteerNote | undefined>
  reply(slug: string, id: string, text: string, author: string): Promise<SteerNote | undefined>
  resolve(slug: string, id: string): Promise<SteerNote | undefined>
  move(
    slug: string,
    id: string,
    coords: { x: number; y: number },
    rect?: { x: number; y: number; w: number; h: number }
  ): Promise<SteerNote | undefined>
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

// The browser port. The bench chrome is built once and is framework-free; a
// host component can only be instantiated by its own framework's runtime, so
// this is the single seam where a framework enters. Adding a framework to
// steer-ui is one Mounter plus one Extractor, never another canvas.

export interface MountHandle {
  /**
   * Replace the mounted component's props in place. Must NOT remount: knob
   * edits would otherwise discard component state on every keystroke.
   * Absent keys are removed, not merged.
   */
  update(props: Record<string, unknown>): void
  /** Tear down and leave the element empty. Idempotent. */
  destroy(): void
}

export interface Mounter {
  /** Framework id, as recorded in the manifest and the install receipt. */
  readonly id: string
  mount(
    el: HTMLElement,
    Component: unknown,
    props: Record<string, unknown>
  ): MountHandle
}

// The bridge. Once the chrome ships prebuilt, it and the host's register entry
// are two separate module graphs that cannot import each other: the chrome is
// an opaque asset the host never compiles. They meet at this protocol instead,
// published on a shared global. Load order is not guaranteed, so either side
// may arrive first.

export interface SteerRegistration {
  /** Module namespaces from the host's glob, keyed by file path. */
  modules: Record<string, Record<string, unknown>>
  /** How this host's framework instantiates one of its components. */
  mounter: Mounter
  /** Default author recorded on notes written from this host. */
  author?: string
}

export type PublishResult =
  | { ok: true; queued: boolean }
  | { ok: false; reason: "protocol-mismatch"; expected: number; found: number }
