import { createSignal, For, mergeProps } from "solid-js"

export interface MantineChipsProps {
  /** The choices. */
  options?: string[]
  /** The pre-review draft: selection is colour only, with no mark. */
  draft?: boolean
}

/** Mantine chip group: pill outline, a check appears when selected. Click them. */
export function MantineChips(props: MantineChipsProps) {
  const p = mergeProps({ options: ["spacing", "colour", "type"], draft: false }, props)
  const [picked, setPicked] = createSignal<string[]>(["colour"])

  const toggle = (option: string) =>
    setPicked((v) => (v.includes(option) ? v.filter((o) => o !== option) : [...v, option]))

  return (
    <div class="flex flex-wrap items-center gap-2">
      <For each={p.options}>
        {(option) => {
          const on = () => picked().includes(option)
          return (
            <button
              type="button"
              onClick={() => toggle(option)}
              class={`refines inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[14px] transition-colors ${
                on()
                  ? "bg-[#e7f5ff] text-[#1971c2] ring-1 ring-[#a5d8ff]"
                  : "text-[#495057] ring-1 ring-[#dee2e6] hover:bg-[#f8f9fa]"
              }`}
            >
              {on() && !p.draft && (
                <svg viewBox="0 0 12 12" class="size-3" fill="none" stroke="currentColor" stroke-width="2.2">
                  <path d="M2.5 6.2 L5 8.5 L9.5 3.5" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              )}
              {option}
            </button>
          )
        }}
      </For>
    </div>
  )
}
