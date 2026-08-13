import { mergeProps } from "solid-js"

export interface PinProps {
  /** Number shown inside the pin. */
  label?: string
  /** Human notes are amber; agent notes are indigo. */
  author?: "human" | "agent"
  /** False fades the pin: it belongs to another state. */
  matchesState?: boolean
  onPointerDown?: (e: PointerEvent) => void
}

/** Numbered note pin. Full when it matches the current state, faded if not. */
export function Pin(props: PinProps) {
  const p = mergeProps({ label: "1", author: "human" as const, matchesState: true }, props)
  const agent = () => p.author === "agent"
  const here = () => p.matchesState
  return (
    <button
      type="button"
      class={`flex size-7 items-center justify-center rounded-full font-mono text-base font-semibold text-white transition-all ${
        agent()
          ? here()
            ? "cursor-grab bg-indigo-500 shadow-[0_2px_10px_rgba(79,70,229,0.45)] hover:scale-110 active:cursor-grabbing"
            : "cursor-pointer scale-75 bg-indigo-500/40 hover:scale-90 hover:bg-indigo-500/70"
          : here()
            ? "cursor-grab bg-amber-400 shadow-[0_2px_10px_rgba(217,119,6,0.45)] hover:scale-110 active:cursor-grabbing"
            : "cursor-pointer scale-75 bg-amber-400/40 hover:scale-90 hover:bg-amber-400/70"
      }`}
      title={here() ? undefined : "Note from another state · click to jump to it"}
      onPointerDown={(e) => p.onPointerDown?.(e)}
    >
      {p.label}
    </button>
  )
}
