import { createSignal, mergeProps } from "solid-js"

export interface ShadcnSwitchProps {
  /** Whether it starts on. */
  checked?: boolean
  /** What the switch controls. */
  label?: string
  /** Small print under the label. */
  hint?: string
  /** The pre-review draft: the off track is so pale it reads as disabled. */
  draft?: boolean
}

/** shadcn/ui switch: peer-driven track, muted tokens, ring on focus. Toggle it. */
export function ShadcnSwitch(props: ShadcnSwitchProps) {
  const p = mergeProps(
    { checked: false, label: "Commit notes with the branch", hint: "Notes travel with the code that answers them.", draft: false },
    props,
  )
  const [on, setOn] = createSignal(p.checked)

  return (
    <div class="flex items-start gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={on()}
        onClick={() => setOn((v) => !v)}
        class={`refines mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full border border-transparent px-0.5 transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-zinc-900/20 ${
          on() ? "bg-zinc-900" : p.draft ? "bg-zinc-100" : "bg-zinc-300"
        }`}
      >
        <span
          class="size-4 rounded-full bg-white shadow-sm transition-transform"
          style={{ transform: on() ? "translateX(16px)" : "translateX(0)" }}
        />
      </button>
      <div class="grid gap-0.5">
        <span class="text-sm font-medium leading-none text-zinc-900">{p.label}</span>
        <span class="text-sm text-zinc-500">{p.hint}</span>
      </div>
    </div>
  )
}
