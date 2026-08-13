import { mergeProps, type JSX } from "solid-js"

export interface BadgeProps {
  /** Who or what the badge speaks for. Human feedback is amber, agent indigo. */
  tone?: "neutral" | "human" | "agent"
  /** The pre-review draft: low contrast, boxy, oversized. */
  draft?: boolean
  children?: JSX.Element
}

/** A small status marker. Carries authorship colour wherever feedback appears. */
export function Badge(props: BadgeProps) {
  const merged = mergeProps({ tone: "neutral" as const, draft: false }, props)

  const classes = () => {
    const base = "refines inline-flex items-center gap-1.5 font-medium whitespace-nowrap"
    const shape = `px-2.5 py-0.5 text-[13px] ${merged.draft ? "rounded-[3px]" : "rounded-full"}`
    const skin =
      merged.tone === "human"
        ? merged.draft ? "bg-amber-50 text-amber-300 ring-1 ring-transparent" : "bg-amber-50 text-amber-700 ring-1 ring-amber-200/70"
        : merged.tone === "agent"
          ? merged.draft ? "bg-indigo-50 text-indigo-300 ring-1 ring-transparent" : "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200/70"
          : merged.draft ? "bg-zinc-100 text-zinc-400 ring-1 ring-transparent" : "bg-zinc-100 text-zinc-600 ring-1 ring-zinc-200/70"
    return `${base} ${shape} ${skin}`
  }

  return <span class={classes()}>{merged.children}</span>
}
