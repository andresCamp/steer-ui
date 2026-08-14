import { GitHubStars } from "./GitHubStars"

export interface LandingPeekProps {
  /** Open notes on this page. */
  count?: number
  /** Armed: the next click places a note. */
  noteMode?: boolean
  benchHref?: string
  onAddNote?: () => void
}

/**
 * The landing page's own peek, forked from the product's live-app chrome
 * (src/adapters/solid/chrome/Peek.tsx) and cut down to what a first-time
 * visitor can use.
 *
 * What the live HUD carries and this one drops: the pins visibility toggle
 * and the width/band readout, both of which only earn their place once you
 * have notes across several widths, and the hairline separators that were
 * dividing tools this variant no longer has. What it gains instead: the site
 * nav's two destinations, so the whole page has one control surface.
 *
 * Forked on purpose. It diverges from the product component rather than
 * pushing marketing-shaped knobs into it, so nothing a host installs has to
 * carry the landing page's decisions.
 */
export function LandingPeek(props: LandingPeekProps) {
  const count = () => props.count ?? 0
  const noteMode = () => props.noteMode ?? false
  const benchHref = () => props.benchHref ?? "/__steer"

  return (
    <div class="pointer-events-none fixed inset-x-4 bottom-4 z-[80] flex justify-center">
      <div class="glass pointer-events-auto flex max-w-full items-center gap-1 rounded-full p-1">
        <span
          class="flex h-10 shrink-0 items-center gap-2 px-3.5 font-mono text-base font-semibold text-zinc-700 tabular-nums"
          title={`${count()} notes on this page`}
        >
          <i class="size-2.5 rounded-full bg-amber-400 shadow-[0_0_0_3px_rgba(251,191,36,0.28)]" />
          {count()}
        </span>

        <button
          type="button"
          class={`flex h-10 shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap rounded-full px-3.5 text-base font-medium transition-colors ${
            noteMode()
              ? "bg-amber-400 text-white shadow-[0_4px_20px_rgba(217,119,6,0.4)]"
              : "text-zinc-600 hover:text-zinc-900"
          }`}
          onClick={() => props.onAddNote?.()}
          data-steer-note-toggle
        >
          {/* The label swaps without moving the buttons beside it. */}
          <span class="inline-grid">
            <span class="invisible col-start-1 row-start-1">Add note</span>
            <span class="col-start-1 row-start-1">{noteMode() ? "Cancel" : "Add note"}</span>
          </span>
          <kbd
            class={`rounded-md px-1.5 py-0.5 font-mono text-base max-[480px]:hidden ${
              noteMode() ? "bg-white/20 text-white" : "bg-black/[0.05] text-zinc-400"
            }`}
          >
            {noteMode() ? "esc" : "C"}
          </kbd>
        </button>

        <a
          class="flex h-10 shrink-0 items-center rounded-full px-3.5 text-base font-medium text-zinc-600 transition-colors hover:bg-black/[0.04] hover:text-zinc-900"
          href={benchHref()}
          rel="external"
        >
          Bench
        </a>

        <span class="shrink-0">
          <GitHubStars />
        </span>
      </div>
    </div>
  )
}
