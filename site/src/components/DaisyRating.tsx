import { createSignal, For, mergeProps } from "solid-js"

export interface DaisyRatingProps {
  /** How many stars are lit to begin with. */
  value?: number
  /** Star size. */
  size?: "sm" | "md"
  /** The pre-review draft: stars too small to hit on the first try. */
  draft?: boolean
}

/** daisyUI rating: a row of stars you can set by clicking. */
export function DaisyRating(props: DaisyRatingProps) {
  const p = mergeProps({ value: 4, size: "md" as const, draft: false }, props)
  const [value, setValue] = createSignal(p.value)

  return (
    <div class="flex items-center justify-center gap-1">
      <For each={[1, 2, 3, 4, 5]}>
        {(i) => (
          <button type="button" onClick={() => setValue(i)} class="refines leading-none">
            <svg
              viewBox="0 0 24 24"
              class={`refines ${p.draft ? "size-3.5" : p.size === "sm" ? "size-4" : "size-6"} ${
                i <= value() ? "text-[#fbbf24]" : "text-[#e5e7eb]"
              }`}
              fill="currentColor"
            >
              <path d="M12 2.5l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5-5.8-3-5.8 3 1.1-6.5L2.6 9.3l6.5-.9z" />
            </svg>
          </button>
        )}
      </For>
    </div>
  )
}
