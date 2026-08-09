// Shared design tokens as types. Imported by components so the steer's
// checked extraction (typecheck: true) has something real to resolve.

export type Tone = "info" | "success" | "danger"

export type Density = 1 | 2 | 3

export interface DismissableProps {
  /** Show a close affordance. */
  dismissable?: boolean
}
