import type { ReactNode } from "react"

export interface CardProps {
  /** Heading shown in the card header */
  title?: string
  /** Footer caption, typically metadata or a summary line */
  footer?: string
  /** Remove body padding for full-bleed content like tables */
  flush?: boolean
  children?: ReactNode
}

/** Content container with optional header and footer. */
export function Card({ title, footer, flush = false, children }: CardProps) {
  return (
    <div className="w-80 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
      {title && (
        <div className="border-b border-zinc-100 px-5 py-3.5">
          <h3 className="text-sm font-semibold text-zinc-900">{title}</h3>
        </div>
      )}
      <div className={flush ? "" : "px-5 py-4"}>{children}</div>
      {footer && (
        <div className="border-t border-zinc-100 bg-zinc-50 px-5 py-2.5 text-xs text-zinc-500">
          {footer}
        </div>
      )}
    </div>
  )
}

export interface CardActionsProps {
  /** Horizontal placement of the actions */
  align?: "left" | "right" | "between"
  children?: ReactNode
}

const alignments: Record<string, string> = {
  left: "justify-start",
  right: "justify-end",
  between: "justify-between",
}

/** Action row for card bodies; compound component (Card.Actions). */
export function CardActions({ align = "right", children }: CardActionsProps) {
  return <div className={`flex items-center gap-2 pt-2 ${alignments[align]}`}>{children}</div>
}

Card.Actions = CardActions
