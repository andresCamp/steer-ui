import { createSignal, For, mergeProps } from "solid-js"

export interface AntSegmentedProps {
  /** The choices. */
  options?: string[]
  /** Which one starts selected. */
  value?: string
  /** Control height, in Ant's sizes. */
  size?: "small" | "middle"
  /** The pre-review draft: the selected pane has no lift, so it reads flat. */
  draft?: boolean
}

/** Ant Design segmented control: compact, 6px radius, a sliding white pane. */
export function AntSegmented(props: AntSegmentedProps) {
  const p = mergeProps(
    { options: ["Open", "Resolved", "All"], value: "Open", size: "middle" as const, draft: false },
    props,
  )
  const [value, setValue] = createSignal(p.value)

  return (
    <div class="inline-flex rounded-[6px] bg-[rgba(0,0,0,0.04)] p-[2px]">
      <For each={p.options}>
        {(option) => (
          <button
            type="button"
            onClick={() => setValue(option)}
            class={`refines rounded-[4px] px-3 text-[14px] transition-colors ${
              p.size === "small" ? "h-6" : "h-7"
            } ${
              value() === option
                ? `bg-white text-[rgba(0,0,0,0.88)] ${p.draft ? "" : "shadow-[0_2px_8px_rgba(0,0,0,0.15)]"}`
                : "text-[rgba(0,0,0,0.65)] hover:text-[rgba(0,0,0,0.88)]"
            }`}
          >
            {option}
          </button>
        )}
      </For>
    </div>
  )
}
