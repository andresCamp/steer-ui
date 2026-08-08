// Shared design tokens as types. Imported by components so the bench's
// checked extraction (typecheck: true) has something real to resolve;
// syntactic extraction alone would classify props typed with these as
// unsupported.

export type Tone = "info" | "success" | "danger"

export type Density = 1 | 2 | 3

export interface DismissableProps {
  /** Show a close affordance. */
  dismissable?: boolean
}
