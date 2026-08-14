import { Show, mergeProps, type JSX } from "solid-js"

export interface CardProps {
  /** Heading shown in the card header */
  title?: string
  /** Footer caption, typically metadata or a summary line */
  footer?: string
  /** Remove body padding for full-bleed content like tables */
  flush?: boolean
  children?: JSX.Element
}

/** Content container with optional header and footer. */
export function Card(props: CardProps) {
  const p = mergeProps({ flush: false }, props)
  return (
    <div class="w-80 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
      <Show when={p.title}>
        <div class="border-b border-zinc-100 px-5 py-3.5">
          <h3 class="text-sm font-semibold text-zinc-900">{p.title}</h3>
        </div>
      </Show>
      <div class={p.flush ? "" : "px-5 py-4"}>{p.children}</div>
      <Show when={p.footer}>
        <div class="border-t border-zinc-100 bg-zinc-50 px-5 py-2.5 text-xs text-zinc-500">
          {p.footer}
        </div>
      </Show>
    </div>
  )
}

export interface CardActionsProps {
  /** Horizontal placement of the actions */
  align?: "left" | "right" | "between"
  children?: JSX.Element
}

const alignments: Record<string, string> = {
  left: "justify-start",
  right: "justify-end",
  between: "justify-between",
}

/** Action row for card bodies; compound component (Card.Actions). */
export function CardActions(props: CardActionsProps) {
  const p = mergeProps({ align: "right" }, props)
  return <div class={`flex items-center gap-2 pt-2 ${alignments[p.align]}`}>{p.children}</div>
}

Card.Actions = CardActions
