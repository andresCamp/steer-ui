import { For, Show, mergeProps } from "solid-js"

export interface NoteReplyView {
  author: string
  createdLabel: string
  text: string
}

export interface NoteThreadProps {
  author?: string
  createdLabel?: string
  text?: string
  replies?: NoteReplyView[]
  /** An answer is coming but has not started arriving yet. */
  thinking?: boolean
  replyValue?: string
  onResolve?: () => void
  onReplyInput?: (value: string) => void
  onReply?: () => void
}

/** Glass popover for a note: author, body, replies, resolve. */
export function NoteThread(props: NoteThreadProps) {
  const p = mergeProps(
    { author: "andres", createdLabel: "now", text: "What feels off?", replies: [] as NoteReplyView[] },
    props,
  )
  return (
    <div
      class="glass w-80 max-w-full rounded-2xl p-4"
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div class="flex items-baseline justify-between gap-3">
        <span class="flex items-baseline gap-2">
          <span class={`font-mono text-base ${p.author === "agent" ? "text-indigo-500" : "text-zinc-400"}`}>
            {p.author}
          </span>
          <span class="font-mono text-base text-zinc-300">{p.createdLabel}</span>
        </span>
        <button
          type="button"
          class="cursor-pointer text-base font-medium text-zinc-400 transition-colors hover:text-zinc-900"
          onClick={() => p.onResolve?.()}
        >
          resolve
        </button>
      </div>
      <p class="mt-1 text-base leading-relaxed text-zinc-800">{p.text}</p>
      <Show when={p.replies.length > 0}>
        <div class="mt-3 flex flex-col gap-2.5 border-t border-black/[0.05] pt-3">
          <For each={p.replies}>
            {(reply) => (
              <div>
                <span class="flex items-baseline gap-2">
                  <span class={`font-mono text-base ${reply.author === "agent" ? "text-indigo-500" : "text-zinc-400"}`}>
                    {reply.author}
                  </span>
                  <span class="font-mono text-base text-zinc-300">{reply.createdLabel}</span>
                </span>
                <p class="mt-0.5 text-base leading-relaxed text-zinc-800">{reply.text}</p>
              </div>
            )}
          </For>
        </div>
      </Show>
      <Show when={p.thinking}>
        <div class="mt-3 flex items-center gap-2 border-t border-black/[0.05] pt-3">
          <span class="font-mono text-base text-indigo-500">agent</span>
          <span class="flex items-center gap-1">
            <For each={[0, 160, 320]}>
              {(delay) => (
                <span
                  class="h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-400"
                  style={{ "animation-delay": `${delay}ms`, "animation-duration": "1.1s" }}
                />
              )}
            </For>
          </span>
        </div>
      </Show>
      <input
        type="text"
        class="mt-3 h-10 w-full rounded-lg bg-black/[0.04] px-3 text-base text-zinc-800 outline-none transition-colors placeholder:text-zinc-300 focus:bg-black/[0.06]"
        placeholder="Reply…"
        value={p.replyValue ?? ""}
        onInput={(e) => p.onReplyInput?.(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") p.onReply?.()
          e.stopPropagation()
        }}
        data-steer-reply-input
      />
    </div>
  )
}
