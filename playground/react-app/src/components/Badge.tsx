import type { ReactNode } from "react"

export interface BadgeProps {
  /** Semantic color of the badge */
  tone?: "neutral" | "success" | "warning" | "danger"
  /** Render with a leading status dot */
  dot?: boolean
  children?: ReactNode
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
export function Badge({ tone = "neutral", dot, children }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${tones[tone]}`}
    >
      {dot && <span className={`size-1.5 rounded-full ${dots[tone]}`} />}
      {children}
    </span>
  )
}
