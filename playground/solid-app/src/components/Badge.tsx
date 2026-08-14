import { mergeProps, Show, type JSX } from "solid-js"

export interface BadgeProps {
  /** Semantic color of the badge */
  tone?: "neutral" | "success" | "warning" | "danger"
  /** Render with a leading status dot */
  dot?: boolean
  children?: JSX.Element
}

const tones: Record<string, string> = {
  neutral: "bg-zinc-100 text-zinc-700",
  success: "bg-emerald-100 text-emerald-800",
  warning: "bg-amber-100 text-amber-800",
  danger: "bg-red-100 text-red-800",
}

const dots: Record<string, string> = {
  neutral: "bg-zinc-400",
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  danger: "bg-red-500",
}

/** Small status label for rows, cards, and headers. */
export function Badge(props: BadgeProps) {
  const p = mergeProps({ tone: "neutral" }, props)
  return (
    <span
      class={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${tones[p.tone]}`}
    >
      <Show when={p.dot}>
        <span class={`size-1.5 rounded-full ${dots[p.tone]}`} />
      </Show>
      {p.children}
    </span>
  )
}
