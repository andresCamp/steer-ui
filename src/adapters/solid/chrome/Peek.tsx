import { Show, createSignal, mergeProps, onCleanup } from "solid-js"

export interface PeekProps {
  /** Open notes on this surface. */
  count?: number
  /** Toolbar visible. The dot is collapse. */
  expanded?: boolean
  noteMode?: boolean
  pinsVisible?: boolean
  width?: number
  band?: string
  here?: number
  away?: number
  benchHref?: string
  /** Fixed HUD on the live app; inline for the bench. */
  placement?: "fixed" | "inline"
  onToggle?: () => void
  onAddNote?: () => void
  onTogglePins?: () => void
}

/** Live-app notes chrome. Collapsed is the count; expanded is the cluster. */
export function Peek(props: PeekProps) {
  const p = mergeProps(
    {
      count: 0,
      expanded: false,
      noteMode: false,
      pinsVisible: false,
      width: 1280,
      band: "xl",
      here: 0,
      away: 0,
      benchHref: "/__steer",
      placement: "inline" as const,
    },
    props,
  )
  const split = () => `${p.here} here · ${p.away} at other widths`
  const docked = () => p.placement === "fixed"
  const peeking = () => docked() && !p.expanded
  const [raised, setRaised] = createSignal(false)
  let leaveTimer: ReturnType<typeof setTimeout> | undefined
  onCleanup(() => clearTimeout(leaveTimer))
  const lift = () => {
    clearTimeout(leaveTimer)
    setRaised(true)
  }
  const settle = () => {
    clearTimeout(leaveTimer)
    leaveTimer = setTimeout(() => setRaised(false), 80)
  }

  return (
    <div
      classList={{
        "flex justify-start": true,
        "fixed left-4 z-[80]": docked(),
        "bottom-0": peeking(),
        "bottom-4": docked() && p.expanded,
      }}
    >
      <div
        class="pointer-events-auto flex items-end"
        classList={{ "h-20": peeking() }}
        on:pointerenter={lift}
        on:pointerleave={settle}
      >
      <div
        class="glass flex max-w-full items-center rounded-full p-1 will-change-transform"
        style={{
          transform: peeking() ? (raised() ? "translateY(-12px)" : "translateY(52%)") : undefined,
          transition: "transform 280ms cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      >
        <button
          type="button"
          class="flex h-10 cursor-pointer items-center gap-2 rounded-full px-3.5 font-mono text-base font-semibold text-zinc-700 tabular-nums hover:text-zinc-900"
          title={p.expanded ? "Collapse" : `${p.count} notes`}
          onClick={() => p.onToggle?.()}
          data-steer-peek
        >
          <i class="size-2.5 rounded-full bg-amber-400 shadow-[0_0_0_3px_rgba(251,191,36,0.28)]" />
          {p.count}
        </button>
        <Show when={p.expanded}>
          <span class="mx-0.5 h-5 w-px bg-black/10" />
          <button
            type="button"
            class={`flex h-10 cursor-pointer items-center gap-2 rounded-full px-3.5 text-base font-medium ${
              p.noteMode
                ? "bg-amber-400 text-white shadow-[0_4px_20px_rgba(217,119,6,0.4)]"
                : "text-zinc-600 hover:text-zinc-900"
            }`}
            onClick={() => p.onAddNote?.()}
            data-steer-note-toggle
          >
            <span class="inline-grid">
              <span class="invisible col-start-1 row-start-1">Add note</span>
              <span class="col-start-1 row-start-1">{p.noteMode ? "Cancel" : "Add note"}</span>
            </span>
            <kbd
              class={`rounded-md px-1.5 py-0.5 font-mono text-base ${
                p.noteMode ? "bg-white/20 text-white" : "bg-black/[0.05] text-zinc-400"
              }`}
            >
              {p.noteMode ? "esc" : "C"}
            </kbd>
          </button>
          <span class="mx-0.5 h-5 w-px bg-black/10" />
          <button
            type="button"
            class={`grid size-10 place-items-center rounded-full ${
              p.pinsVisible ? "text-zinc-600 hover:text-zinc-900" : "text-zinc-400 hover:text-zinc-700"
            }`}
            title={p.pinsVisible ? "Hide pins" : "Show pins"}
            aria-pressed={p.pinsVisible}
            onClick={() => p.onTogglePins?.()}
          >
            <Show
              when={p.pinsVisible}
              fallback={
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M3 3l18 18" />
                  <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
                  <path d="M9.4 5.5A10.6 10.6 0 0 1 12 5c6.5 0 10 7 10 7a18 18 0 0 1-2.2 3.3" />
                  <path d="M6.7 6.7C3.8 8.6 2 12 2 12s3.5 7 10 7a10.4 10.4 0 0 0 4.2-.9" />
                </svg>
              }
            >
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </Show>
          </button>
          <span class="mx-0.5 h-5 w-px bg-black/10" />
          <div class="flex min-w-0 flex-col justify-center px-3 py-1 text-base leading-tight text-zinc-700 tabular-nums" title={split()}>
            <span>
              {p.width}px · {p.band}
            </span>
            <span class="text-zinc-500 max-[560px]:hidden">{split()}</span>
          </div>
          <span class="mx-0.5 h-5 w-px bg-black/10" />
          <a
            class="grid size-10 place-items-center rounded-full text-zinc-600 hover:text-zinc-900"
            href={p.benchHref}
            rel="external"
            title="Open in bench"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M7 17L17 7" />
              <path d="M8 7h9v9" />
            </svg>
          </a>
        </Show>
      </div>
      </div>
    </div>
  )
}
