import { createSignal, mergeProps } from "solid-js"

export interface MaterialFieldProps {
  /** Floating label, which shrinks up when the field has focus or content. */
  label?: string
  /** Starting value. */
  value?: string
  /** The pre-review draft: the label lands on the underline when it shrinks. */
  draft?: boolean
}

/** Material filled text field, with the label that floats. Type in it. */
export function MaterialField(props: MaterialFieldProps) {
  const p = mergeProps({ label: "Component name", value: "", draft: false }, props)
  const [value, setValue] = createSignal(p.value)
  const [focused, setFocused] = createSignal(false)
  const up = () => focused() || value().length > 0

  return (
    <label
      class={`refines relative flex h-14 w-full items-end rounded-t-[4px] bg-[#e7e0ec] px-4 ${
        focused() ? "shadow-[inset_0_-2px_0_#6750a4]" : "shadow-[inset_0_-1px_0_#79747e]"
      }`}
    >
      <span
        class="pointer-events-none absolute left-4 origin-left text-[#49454f] transition-all duration-200"
        style={{
          transform: up() ? `translateY(${props.draft ? "-8px" : "-22px"}) scale(0.75)` : "translateY(0)",
          top: up() ? "50%" : "50%",
          "font-size": "16px",
          "margin-top": up() ? "0" : "-11px",
          color: focused() ? "#6750a4" : "#49454f",
        }}
      >
        {p.label}
      </span>
      <input
        value={value()}
        onInput={(e) => setValue(e.currentTarget.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        class="h-8 w-full bg-transparent pb-1 text-[16px] text-[#1d1b20] outline-none"
      />
    </label>
  )
}
