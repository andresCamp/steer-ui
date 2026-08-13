import { For, mergeProps } from "solid-js"

export interface ChakraAvatarGroupProps {
  /** Initials, one per avatar. */
  people?: string[]
  /** How many to show before the overflow count. */
  max?: number
  /** The pre-review draft: no ring, so the circles smear into each other. */
  draft?: boolean
}

/** Chakra avatar group: soft colours, ring separation, an overflow count. */
export function ChakraAvatarGroup(props: ChakraAvatarGroupProps) {
  const p = mergeProps({ people: ["AC", "JR", "MS", "TK", "LP"], max: 3, draft: false }, props)
  const shown = () => p.people.slice(0, p.max)
  const rest = () => p.people.length - p.max
  const tones = ["bg-[#805ad5]", "bg-[#dd6b20]", "bg-[#38a169]", "bg-[#3182ce]"]

  return (
    <div class="flex items-center">
      <For each={shown()}>
        {(person, i) => (
          <span
            class={`refines flex size-10 items-center justify-center rounded-full text-[14px] font-medium text-white ${
              tones[i() % tones.length]
            } ${p.draft ? "" : "ring-2 ring-[#f7f7f8]"} ${i() === 0 ? "" : "-ml-2.5"}`}
          >
            {person}
          </span>
        )}
      </For>
      {rest() > 0 && (
        <span
          class={`refines -ml-2.5 flex size-10 items-center justify-center rounded-full bg-[#e2e8f0] text-[14px] font-medium text-[#4a5568] ${
            p.draft ? "" : "ring-2 ring-[#f7f7f8]"
          }`}
        >
          +{rest()}
        </span>
      )}
    </div>
  )
}
