import { mergeProps, type JSX } from "solid-js"

export interface ToolbarProps {
  /** Visual weight of the bar */
  tone?: "plain" | "raised"
  children?: JSX.Element
}

const tones: Record<string, string> = {
  plain: "bg-transparent",
  raised: "rounded-xl border border-zinc-200 bg-white px-3 py-2 shadow-sm",
}

/** Horizontal action bar; compound component via Object.assign. */
function ToolbarRoot(props: ToolbarProps) {
  const p = mergeProps({ tone: "plain" }, props)
  return <div class={`flex items-center gap-2 ${tones[p.tone]}`}>{p.children}</div>
}

export interface ToolbarSpacerProps {}

/** Flexible gap that pushes toolbar items apart. */
export function ToolbarSpacer(_props: ToolbarSpacerProps) {
  return <div class="flex-1" />
}

export const Toolbar = Object.assign(ToolbarRoot, { Spacer: ToolbarSpacer })
