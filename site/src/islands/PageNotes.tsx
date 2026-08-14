import { createSignal, onCleanup, onMount, For, Show } from "solid-js"
import { LandingPeek } from "../components/LandingPeek"
import { GhostPin } from "../../../src/adapters/solid/chrome/GhostPin"
import { Pin } from "../../../src/adapters/solid/chrome/Pin"
import { NoteThread } from "../../../src/adapters/solid/chrome/NoteThread"
import { Floater } from "../../../src/adapters/solid/chrome/Floater"
import type { SteerNote } from "../../../src/core/model"

/**
 * Note mode on the marketing page itself, using the product's own ghost pin,
 * pins and threads under the landing page's own peek. Notes go to
 * localStorage here; in a real host they are JSON files in the repo.
 */

const KEY = "steerui:page-notes"

/** Viewport margins a note panel may not cross. The bottom clears the peek. */
const KEEP_OUT = { top: 16, right: 16, bottom: 88, left: 16 }

function load(): SteerNote[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as SteerNote[]
  } catch {
    return []
  }
}

function describe(el: Element | null): string {
  if (!el) return "body"
  return el.closest("[data-steer]")?.getAttribute("data-steer") ?? el.tagName.toLowerCase()
}

function ago(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (seconds < 60) return "now"
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
  return `${Math.floor(seconds / 3600)}h`
}

export default function PageNotes() {
  const [notes, setNotes] = createSignal<SteerNote[]>([])
  const [noteMode, setNoteMode] = createSignal(false)
  const [width, setWidth] = createSignal(1280)
  const [ghost, setGhost] = createSignal<{ x: number; y: number } | null>(null)
  const [draft, setDraft] = createSignal<{ x: number; y: number; selector: string } | null>(null)
  const [text, setText] = createSignal("")
  const [open, setOpen] = createSignal<string | null>(null)
  // Pins held by the cursor, in page space, keyed by note id.
  const [dragging, setDragging] = createSignal<Record<string, { x: number; y: number }>>({})

  const openNotes = () => notes().filter((n) => n.status === "open")

  const persist = (next: SteerNote[]) => {
    setNotes(next)
    try {
      localStorage.setItem(KEY, JSON.stringify(next))
    } catch {
      /* a blocked store is a visible no-op, never a crash */
    }
  }

  const disarm = () => {
    setNoteMode(false)
    setGhost(null)
    document.body.classList.remove("no-cursor")
  }
  const arm = () => {
    setNoteMode(true)
    setOpen(null)
    document.body.classList.add("no-cursor")
  }

  onMount(() => {
    setNotes(load())
    setWidth(window.innerWidth)

    // Pins are stored as fractions of the viewport, so they need the live
    // width to land in the right place after a resize.
    const onResize = () => setWidth(window.innerWidth)
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      const typing = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")
      if (e.key === "Escape") {
        setDraft(null)
        setText("")
        setOpen(null)
        disarm()
        return
      }
      if (typing) return
      if (e.key === "c" || e.key === "C") {
        e.preventDefault()
        noteMode() ? disarm() : arm()
      }
    }
    const onMove = (e: MouseEvent) => noteMode() && setGhost({ x: e.pageX, y: e.pageY })
    // Capture phase, so a pin lands on links and buttons instead of following them.
    const onClick = (e: MouseEvent) => {
      if (!noteMode()) return
      e.preventDefault()
      e.stopPropagation()
      setDraft({
        x: e.pageX,
        y: e.pageY,
        selector: describe(document.elementFromPoint(e.clientX, e.clientY)),
      })
      disarm()
    }

    window.addEventListener("resize", onResize)
    document.addEventListener("keydown", onKey)
    document.addEventListener("mousemove", onMove)
    document.addEventListener("click", onClick, true)
    onCleanup(() => {
      window.removeEventListener("resize", onResize)
      document.removeEventListener("keydown", onKey)
      document.removeEventListener("mousemove", onMove)
      document.removeEventListener("click", onClick, true)
      document.body.classList.remove("no-cursor")
    })
  })

  const commit = () => {
    const d = draft()
    if (!d || !text().trim()) return
    persist([
      ...notes(),
      {
        id: `n${Date.now().toString(36)}`,
        component: "landing",
        stateUrl: "/",
        selector: d.selector,
        coords: { x: d.x / window.innerWidth, y: d.y / window.innerHeight },
        text: text().trim(),
        author: "andrés",
        status: "open",
        created: new Date().toISOString(),
        replies: [],
      },
    ])
    setDraft(null)
    setText("")
  }

  const resolve = (id: string) =>
    persist(notes().map((n) => (n.id === id ? { ...n, status: "resolved" as const } : n)))

  const pinAt = (n: SteerNote) =>
    dragging()[n.id] ?? { x: n.coords.x * width(), y: n.coords.y * window.innerHeight }

  /**
   * Drag a pin to re-place it. A press that never travels is still a click:
   * it opens the thread. Anything past the threshold moves the note.
   */
  const onPinDrag = (n: SteerNote) => (e: PointerEvent) => {
    if (noteMode()) return
    e.preventDefault()
    const sx = e.pageX
    const sy = e.pageY
    let moved = false
    const move = (ev: PointerEvent) => {
      if (!moved && Math.abs(ev.pageX - sx) + Math.abs(ev.pageY - sy) <= 4) return
      moved = true
      setDragging((prev) => ({ ...prev, [n.id]: { x: ev.pageX, y: ev.pageY } }))
    }
    const up = () => {
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", up)
      const at = dragging()[n.id]
      if (!moved || !at) {
        setOpen(open() === n.id ? null : n.id)
        return
      }
      persist(
        notes().map((x) =>
          x.id === n.id
            ? { ...x, coords: { x: at.x / width(), y: at.y / window.innerHeight } }
            : x,
        ),
      )
      setDragging((prev) => {
        const next = { ...prev }
        delete next[n.id]
        return next
      })
    }
    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", up)
  }

  return (
    <>
      <div class="pointer-events-none absolute inset-0 z-40">
        <For each={openNotes()}>
          {(n, i) => {
            // The thread hangs off this node rather than off coordinates.
            let pinEl: HTMLSpanElement | undefined
            return (
            <span
              ref={pinEl}
              class="pointer-events-auto absolute"
              style={{
                left: `${pinAt(n).x}px`,
                top: `${pinAt(n).y}px`,
                // The cursor holds the middle of the pin, never its corner.
                transform: "translate(-50%, -50%)",
              }}
            >
              <Pin
                label={String(i() + 1)}
                author={n.author === "agent" ? "agent" : "human"}
                onPointerDown={onPinDrag(n)}
              />
              <Show when={open() === n.id}>
                <Floater anchor={() => pinEl} keepOut={KEEP_OUT} class="note-opaque">
                  <NoteThread
                    author={n.author}
                    createdLabel={ago(n.created)}
                    text={n.text}
                    onResolve={() => resolve(n.id)}
                  />
                </Floater>
              </Show>
            </span>
            )
          }}
        </For>

        <Show when={draft()}>
          {(d) => {
            // The ghost the cursor was carrying becomes a real pin the moment
            // the spot is chosen, and the composer hangs off that pin. Without
            // it the note has no visible target while it is being written.
            let dropEl: HTMLSpanElement | undefined
            return (
            <>
            <span
              ref={dropEl}
              class="pointer-events-none absolute"
              style={{ left: `${d().x}px`, top: `${d().y}px`, transform: "translate(-50%, -50%)" }}
            >
              <span class="pin-drop block">
                <Pin label={String(openNotes().length + 1)} />
              </span>
            </span>
            <Floater anchor={() => dropEl} keepOut={KEEP_OUT} class="note-opaque">
              <div class="glass pointer-events-auto w-80 max-w-full rounded-2xl p-4">
                <div class="mb-2 font-mono text-base text-zinc-400">{d().selector}</div>
                <input
                  // Focus after the frame the popover is promoted in: a
                  // popover is display:none until then, and hidden elements
                  // cannot take focus.
                  ref={(el) => requestAnimationFrame(() => el.focus())}
                  value={text()}
                  onInput={(e) => setText(e.currentTarget.value)}
                  onKeyDown={(e) => e.key === "Enter" && commit()}
                  placeholder="What feels off?"
                  class="w-full rounded-xl bg-black/[0.04] px-3 py-2 text-base outline-none placeholder:text-zinc-400"
                />
                <div class="mt-2 flex items-center justify-between font-mono text-base text-zinc-300">
                  <span>enter to save</span>
                  <button type="button" class="hover:text-zinc-500" onClick={() => setDraft(null)}>
                    cancel
                  </button>
                </div>
              </div>
            </Floater>
            </>
            )
          }}
        </Show>
      </div>

      <Show when={noteMode() && ghost()}>
        {(g) => (
          <div
            class="pointer-events-none absolute z-50"
            style={{ left: `${g().x}px`, top: `${g().y}px`, transform: "translate(-50%, -50%)" }}
          >
            <GhostPin />
          </div>
        )}
      </Show>

      <LandingPeek
        count={openNotes().length}
        noteMode={noteMode()}
        benchHref="/__steer"
        onAddNote={() => (noteMode() ? disarm() : arm())}
      />
    </>
  )
}
