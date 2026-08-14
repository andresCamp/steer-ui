import { Show } from "solid-js"
import Plus from "lucide-solid/icons/plus"

export interface GhostPinProps {
  /** Preview of where a new note would land. */
  visible?: boolean
}

/** Translucent pin that follows the cursor in note mode. */
export function GhostPin(props: GhostPinProps) {
  return (
    <Show when={props.visible !== false}>
      <div class="pointer-events-none flex size-7 items-center justify-center rounded-full bg-amber-400/60 shadow-[0_2px_10px_rgba(217,119,6,0.3)] ring-2 ring-white/70">
        <Plus size={16} stroke-width={2} class="text-white" />
      </div>
    </Show>
  )
}
