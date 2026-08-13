import { mergeProps, splitProps, type JSX } from "solid-js"

export interface ButtonProps {
  /** Visual weight. Primary is the single page action. */
  variant?: "primary" | "secondary" | "ghost"
  /** Control height. */
  size?: "sm" | "md"
  /** The pre-review draft: sharp corners, cramped padding, flat press. */
  draft?: boolean
  /** Label text. */
  children?: JSX.Element
  onClick?: () => void
  href?: string
}

/** The page's only button. Every call to action on steerui.com is this component. */
export function Button(props: ButtonProps) {
  const merged = mergeProps({ variant: "primary" as const, size: "md" as const, draft: false }, props)
  const [, rest] = splitProps(merged, ["variant", "size", "draft", "children", "href"])

  const classes = () => {
    const base = "refines inline-flex items-center justify-center gap-2 font-medium select-none"
    const shape = merged.draft ? "rounded-[4px]" : "rounded-full"
    // Padding and type stay fixed in both states: refining a component must
    // never change its footprint, or everything around it jumps.
    const pad = merged.size === "sm" ? "px-4 py-1.5 text-[15px]" : "px-5 py-2.5 text-base"
    const skin =
      merged.variant === "primary"
        ? merged.draft
          ? "bg-zinc-900 text-white shadow-none"
          : "bg-zinc-900 text-white shadow-[0_1px_2px_rgba(0,0,0,0.12),0_6px_16px_rgba(0,0,0,0.14)] hover:bg-zinc-800"
        : merged.variant === "secondary"
          ? merged.draft
            ? "bg-white text-zinc-900 border border-zinc-400"
            : "bg-white text-zinc-900 border border-zinc-200/90 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:border-zinc-300"
          : merged.draft
            ? "text-zinc-500"
            : "text-zinc-600 hover:text-zinc-900"
    return `${base} ${shape} ${pad} ${skin}`
  }

  return (
    <a class={classes()} href={props.href ?? "#"} {...rest}>
      {merged.children}
    </a>
  )
}
