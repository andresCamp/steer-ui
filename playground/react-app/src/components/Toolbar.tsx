import type { ReactNode } from "react"

export interface ToolbarProps {
  /** Visual weight of the bar */
  tone?: "plain" | "raised"
  children?: ReactNode
}

const tones: Record<string, string> = {
  plain: "bg-transparent",
  raised: "rounded-xl border border-zinc-200 bg-white px-3 py-2 shadow-sm",
}

/** Horizontal action bar; compound component via Object.assign. */
function ToolbarRoot({ tone = "plain", children }: ToolbarProps) {
  return <div className={`flex items-center gap-2 ${tones[tone]}`}>{children}</div>
}

export interface ToolbarSpacerProps {}

/** Flexible gap that pushes toolbar items apart. */
export function ToolbarSpacer(_props: ToolbarSpacerProps) {
  return <div className="flex-1" />
}

export const Toolbar = Object.assign(ToolbarRoot, { Spacer: ToolbarSpacer })
