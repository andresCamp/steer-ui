import { createSignal, mergeProps } from "solid-js"

export interface HeroSliderProps {
  /** Starting position, 0 to 100. */
  value?: number
  /** What the slider controls. */
  label?: string
  /** The pre-review draft: the thumb is the same size as the track. */
  draft?: boolean
}

/** HeroUI slider: thick rounded track, filled progress, grabbable thumb. Drag it. */
export function HeroSlider(props: HeroSliderProps) {
  const p = mergeProps({ value: 62, label: "Canvas zoom", draft: false }, props)
  const [value, setValue] = createSignal(p.value)

  return (
    <div class="w-full">
      <div class="mb-2 flex items-baseline justify-between">
        <span class="text-[14px] text-[#71717a]">{p.label}</span>
        <span class="font-mono text-[13px] text-[#a1a1aa]">{Math.round(value())}%</span>
      </div>
      <div class="relative h-6">
        <div class="absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-[#e4e4e7]" />
        <div
          class="absolute left-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-[#006fee]"
          style={{ width: `${value()}%` }}
        />
        <span
          class={`refines pointer-events-none absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white ${
            p.draft ? "size-2 shadow-none" : "size-5 shadow-[0_1px_3px_rgba(0,0,0,0.25)]"
          }`}
          style={{ left: `${value()}%` }}
        />
        <input
          type="range"
          min="0"
          max="100"
          value={value()}
          onInput={(e) => setValue(Number(e.currentTarget.value))}
          class="absolute inset-0 h-full w-full cursor-grab opacity-0 active:cursor-grabbing"
        />
      </div>
    </div>
  )
}
