import { createSignal, mergeProps } from "solid-js"

export interface CopyBoxProps {
  /** The line a visitor copies and pastes into their agent. */
  command?: string
  /** Prompt character shown before the command. */
  prompt?: string
  /** The pre-review draft: boxy, tight, no feedback on copy. */
  draft?: boolean
}

/** The install command, click to copy. The page's single call to action. */
export function CopyBox(props: CopyBoxProps) {
  const merged = mergeProps({
      command: "Set up steer-ui here: follow steerui.com/install.md",
      prompt: "",
      draft: false,
    }, props)
  const [copied, setCopied] = createSignal(false)

  const copy = () => {
    navigator.clipboard?.writeText(merged.command)
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }

  return (
    <button
      type="button"
      onClick={copy}
      data-steer="CopyBox"
      class={`refines group inline-flex w-full max-w-[580px] items-center gap-3 text-left ${
        merged.draft
          ? "rounded-[3px] border border-zinc-500 bg-white px-4 py-3"
          : "smooth-corners-sm border border-black/[0.08] bg-white px-4 py-3 hover:border-black/20"
      }`}
    >
      {merged.prompt && <span class="font-mono text-[15px] text-zinc-400">{merged.prompt}</span>}
      <span class="min-w-0 flex-1 truncate font-mono text-[15px] text-zinc-800">{merged.command}</span>
      <span class={`refines shrink-0 text-[13px] font-medium ${copied() ? "text-emerald-600" : "text-zinc-400 group-hover:text-zinc-600"}`}>
        {copied() ? "Copied" : "Copy"}
      </span>
    </button>
  )
}
