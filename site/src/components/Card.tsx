import { mergeProps, type JSX } from "solid-js"

export interface CardProps {
  /** Heading line. */
  title?: string
  /** Supporting sentence. */
  body?: string
  /** Surface treatment. */
  tone?: "plain" | "raised"
  /** The pre-review draft: the border reads too dark and the radius is hard. */
  draft?: boolean
  children?: JSX.Element
}

/** A bordered content surface. The page uses it for anything that groups. */
export function Card(props: CardProps) {
  const merged = mergeProps({ tone: "raised" as const, draft: false }, props)

  const classes = () => {
    const base = "refines bg-white p-5"
    const shape = merged.draft ? "rounded-[4px]" : "smooth-corners-sm"
    const skin = merged.draft
      ? "border border-zinc-500 shadow-none"
      : merged.tone === "raised"
        ? "border border-black/[0.07]"
        : "border border-zinc-200/80"
    return `${base} ${shape} ${skin}`
  }

  return (
    <div class={classes()}>
      {props.title && <div class="text-base font-semibold text-zinc-900">{props.title}</div>}
      {props.body && <p class="mt-1 text-[15px] leading-relaxed text-zinc-600">{props.body}</p>}
      {props.children}
    </div>
  )
}
