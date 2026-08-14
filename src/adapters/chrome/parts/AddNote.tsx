import { mergeProps } from "solid-js"
import MessageSquarePlus from "lucide-solid/icons/message-square-plus"

export interface AddNoteProps {
  /** Armed: the next click places a note. */
  noteMode?: boolean
  onClick?: () => void
}

/** Workshop pill. Bottom-center; amber when note mode is on. */
export function AddNote(props: AddNoteProps) {
  const p = mergeProps({ noteMode: false }, props)
  return (
    <div class="group relative">
      <div class="glass pointer-events-none absolute bottom-full left-1/2 mb-2.5 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
        <span class="text-base font-medium text-zinc-700">{p.noteMode ? "Cancel" : "Add note"}</span>
        <kbd class="rounded-md bg-black/[0.05] px-1.5 py-0.5 font-mono text-base text-zinc-400">
          {p.noteMode ? "esc" : "C"}
        </kbd>
      </div>
      <button
        type="button"
        class={`flex h-13 cursor-pointer items-center gap-2.5 rounded-full px-6 text-base font-medium transition-all ${
          p.noteMode
            ? "bg-amber-400 text-white shadow-[0_4px_20px_rgba(217,119,6,0.4)]"
            : "glass text-zinc-600 hover:text-zinc-900"
        }`}
        onClick={() => p.onClick?.()}
        data-steer-note-toggle
      >
        <MessageSquarePlus size={20} stroke-width={1.75} />
        {p.noteMode ? "Cancel" : "Add note"}
      </button>
    </div>
  )
}
