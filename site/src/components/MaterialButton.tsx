import { createSignal, mergeProps, For } from "solid-js"

export interface MaterialButtonProps {
  /** Label text. Material buttons letter-space their labels. */
  label?: string
  /** Emphasis, in Material's terms. */
  variant?: "contained" | "outlined" | "text"
  /** The pre-review draft: no elevation, so it reads as a flat rectangle. */
  draft?: boolean
}

/**
 * Material Design 3 button: filled surface, elevation, letter-spaced label,
 * and a ripple that starts where you press. Click it.
 */
export function MaterialButton(props: MaterialButtonProps) {
  const p = mergeProps({ label: "Resolve note", variant: "contained" as const, draft: false }, props)
  const [ripples, setRipples] = createSignal<{ id: number; x: number; y: number }[]>([])

  const press = (e: MouseEvent) => {
    const box = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const id = Date.now()
    setRipples((r) => [...r, { id, x: e.clientX - box.left, y: e.clientY - box.top }])
    setTimeout(() => setRipples((r) => r.filter((v) => v.id !== id)), 600)
  }

  const skin = () =>
    p.variant === "contained"
      ? `bg-[#6750a4] text-white ${p.draft ? "" : "shadow-[0_1px_2px_rgba(0,0,0,0.3),0_1px_3px_1px_rgba(0,0,0,0.15)]"}`
      : p.variant === "outlined"
        ? "border border-[#79747e] text-[#6750a4]"
        : "text-[#6750a4]"

  return (
    <button
      type="button"
      onClick={press}
      class={`refines relative inline-flex h-10 items-center justify-center overflow-hidden rounded-[20px] px-6 text-[14px] font-medium tracking-[0.1px] ${skin()}`}
    >
      {p.label}
      <For each={ripples()}>
        {(r) => (
          <span
            class="ripple pointer-events-none absolute rounded-full bg-white/30"
            style={{ left: `${r.x}px`, top: `${r.y}px` }}
          />
        )}
      </For>
    </button>
  )
}
