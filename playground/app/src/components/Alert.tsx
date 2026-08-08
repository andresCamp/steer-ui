import { Show, type JSX } from "solid-js"
import X from "lucide-solid/icons/x"
import type { Density, DismissableProps, Tone } from "./types"

export type AlertProps = DismissableProps & {
  /** Semantic color of the message. */
  tone?: Tone
  /** Vertical padding scale. */
  density?: Density
  title: string
  children?: JSX.Element
}

const tones: Record<Tone, string> = {
  info: "border-sky-200 bg-sky-50 text-sky-900",
  success: "border-emerald-200 bg-emerald-50 text-emerald-900",
  danger: "border-red-200 bg-red-50 text-red-900",
}

const densities: Record<Density, string> = { 1: "py-2", 2: "py-3", 3: "py-4" }

/** Inline alert whose props come from imported types (checked extraction demo). */
export function Alert(props: AlertProps) {
  return (
    <div
      class={`flex items-start gap-3 rounded-xl border px-4 text-sm ${
        tones[props.tone ?? "info"]
      } ${densities[props.density ?? 2]}`}
      role="status"
    >
      <div class="min-w-0 flex-1">
        <p class="font-semibold">{props.title}</p>
        <Show when={props.children}>
          <p class="mt-0.5 opacity-80">{props.children}</p>
        </Show>
      </div>
      <Show when={props.dismissable}>
        <button
          type="button"
          class="cursor-pointer rounded-md p-0.5 opacity-50 transition-opacity hover:opacity-100"
          aria-label="Dismiss"
        >
          <X size={16} stroke-width={2} />
        </button>
      </Show>
    </div>
  )
}
