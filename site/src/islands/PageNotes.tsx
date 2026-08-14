import { createSignal, onCleanup, onMount, For, Show } from "solid-js"
import ArrowUp from "lucide-solid/icons/arrow-up"
import { LandingPeek } from "../components/LandingPeek"
import { GhostPin } from "../../../src/adapters/chrome/parts/GhostPin"
import { Pin } from "../../../src/adapters/chrome/parts/Pin"
import { NoteThread } from "../../../src/adapters/chrome/parts/NoteThread"
import { Floater } from "../../../src/adapters/chrome/parts/Floater"
import type { SteerNote } from "../../../src/core/model"

/**
 * Note mode on the marketing page itself, using the product's own ghost pin,
 * pins and threads under the landing page's own peek. Notes go to
 * localStorage here; in a real host they are JSON files in the repo.
 *
 * Placement mirrors the bench (src/adapters/chrome/SteerComponent.tsx): a
 * press drops a pin, a drag highlights the region the note is about. Both are
 * one pointer sequence, so the page never understands half a gesture.
 */

const KEY = "steerui:page-notes"

/** Viewport margins a note panel may not cross. The bottom clears the peek. */
const KEEP_OUT = { top: 16, right: 16, bottom: 88, left: 16 }

/** Travel that turns a press into a drag, and a pin into a region. */
const DRAG_SLOP = 6

type Box = { x: number; y: number; w: number; h: number }

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

/** Chrome a note may never be placed on: the peek, and any open panel. */
function isChrome(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null
  return !!el?.closest?.("[data-steer-floater], [data-steer-peek]")
}

export default function PageNotes() {
  const [notes, setNotes] = createSignal<SteerNote[]>([])
  const [noteMode, setNoteMode] = createSignal(false)
  // Pins are stored as fractions of the viewport, so both axes need the live
  // size to land in the right place after a resize.
  const [size, setSize] = createSignal({ w: 1280, h: 800 })
  const [ghost, setGhost] = createSignal<{ x: number; y: number } | null>(null)
  const [marquee, setMarquee] = createSignal<Box | null>(null)
  const [draft, setDraft] = createSignal<{
    x: number
    y: number
    selector: string
    rect?: Box
  } | null>(null)
  const [text, setText] = createSignal("")
  const [open, setOpen] = createSignal<string | null>(null)
  // Pins held by the cursor, in page space, keyed by note id.
  const [dragging, setDragging] = createSignal<
    Record<string, { x: number; y: number; rect?: Box }>
  >({})

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
    setMarquee(null)
    document.body.classList.remove("no-cursor")
  }
  const arm = () => {
    setNoteMode(true)
    setOpen(null)
    document.body.classList.add("no-cursor")
  }

  const commit = () => {
    const d = draft()
    if (!d || !text().trim()) return
    const { w, h } = size()
    persist([
      ...notes(),
      {
        id: `n${Date.now().toString(36)}`,
        component: "landing",
        stateUrl: "/",
        selector: d.selector,
        coords: { x: d.x / w, y: d.y / h },
        ...(d.rect
          ? { rect: { x: d.rect.x / w, y: d.rect.y / h, w: d.rect.w / w, h: d.rect.h / h } }
          : {}),
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

  const discard = () => {
    setDraft(null)
    setText("")
  }

  onMount(() => {
    setNotes(load())
    setSize({ w: window.innerWidth, h: window.innerHeight })

    // A press placed a note, so the click it becomes belongs to note mode and
    // not to whatever link sits underneath. One click, then the page is the
    // page again.
    let swallowClick = false

    const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight })

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        discard()
        setOpen(null)
        disarm()
        return
      }
      const t = e.target as HTMLElement | null
      const typing = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")
      // A composer on screen owns the keyboard, focused or not. Otherwise a
      // stray keystroke re-arms note mode behind the open panel and the page
      // is in two modes at once.
      if (typing || draft()) return
      if (e.key === "c" || e.key === "C") {
        e.preventDefault()
        noteMode() ? disarm() : arm()
      }
    }

    const onMove = (e: MouseEvent) => noteMode() && setGhost({ x: e.pageX, y: e.pageY })

    /**
     * Placement, both gestures. A press that never travels is a pin. Anything
     * past the slop draws the region the note is about, and the pin still
     * lands under the cursor rather than on a corner of the box it drew.
     */
    const onPointerDown = (e: PointerEvent) => {
      // A press away from an open composer closes it: text is kept, an empty
      // draft is dropped. The alternative is a panel that sits there looking
      // ready while every keystroke goes to an input that lost focus.
      if (draft() && !isChrome(e.target)) {
        text().trim() ? commit() : discard()
        return
      }
      if (!noteMode() || isChrome(e.target)) return
      e.preventDefault()

      const sx = e.pageX
      const sy = e.pageY
      let dragged = false

      const move = (ev: PointerEvent) => {
        if (Math.abs(ev.pageX - sx) + Math.abs(ev.pageY - sy) > DRAG_SLOP) dragged = true
        setGhost({ x: ev.pageX, y: ev.pageY })
        if (dragged) {
          setMarquee({
            x: Math.min(sx, ev.pageX),
            y: Math.min(sy, ev.pageY),
            w: Math.abs(ev.pageX - sx),
            h: Math.abs(ev.pageY - sy),
          })
        }
      }

      const up = (ev: PointerEvent) => {
        window.removeEventListener("pointermove", move)
        window.removeEventListener("pointerup", up)
        const rect = dragged ? (marquee() ?? undefined) : undefined
        setDraft({
          x: ev.pageX,
          y: ev.pageY,
          selector: describe(document.elementFromPoint(ev.clientX, ev.clientY)),
          rect,
        })
        swallowClick = true
        // A press with no travel always produces a click; a drag across two
        // elements may not. Either way the flag clears itself.
        setTimeout(() => (swallowClick = false), 350)
        disarm()
      }

      window.addEventListener("pointermove", move)
      window.addEventListener("pointerup", up)
    }

    // Capture phase, so a pin lands on links and buttons instead of following
    // them. The chrome is exempt: the button that armed note mode has to stay
    // the button that cancels it.
    const onClick = (e: MouseEvent) => {
      if (isChrome(e.target)) return
      if (!noteMode() && !swallowClick) return
      e.preventDefault()
      e.stopPropagation()
      swallowClick = false
    }

    window.addEventListener("resize", onResize)
    document.addEventListener("keydown", onKey)
    document.addEventListener("mousemove", onMove)
    document.addEventListener("pointerdown", onPointerDown, true)
    document.addEventListener("click", onClick, true)
    onCleanup(() => {
      window.removeEventListener("resize", onResize)
      document.removeEventListener("keydown", onKey)
      document.removeEventListener("mousemove", onMove)
      document.removeEventListener("pointerdown", onPointerDown, true)
      document.removeEventListener("click", onClick, true)
      document.body.classList.remove("no-cursor")
    })
  })

  const resolve = (id: string) =>
    persist(notes().map((n) => (n.id === id ? { ...n, status: "resolved" as const } : n)))

  const pinAt = (n: SteerNote) =>
    dragging()[n.id] ?? { x: n.coords.x * size().w, y: n.coords.y * size().h }

  /** A note's region in page space, following the pin while it is dragged. */
  const rectAt = (n: SteerNote): Box | undefined => {
    const held = dragging()[n.id]
    if (held) return held.rect
    if (!n.rect) return undefined
    const { w, h } = size()
    return { x: n.rect.x * w, y: n.rect.y * h, w: n.rect.w * w, h: n.rect.h * h }
  }

  /**
   * Drag a pin to re-place it. A press that never travels is still a click:
   * it opens the thread. Anything past the threshold moves the note, and its
   * region travels with it.
   */
  const onPinDrag = (n: SteerNote) => (e: PointerEvent) => {
    if (noteMode()) return
    e.preventDefault()
    e.stopPropagation()
    const sx = e.pageX
    const sy = e.pageY
    const from = pinAt(n)
    const fromRect = rectAt(n)
    let moved = false
    const move = (ev: PointerEvent) => {
      if (!moved && Math.abs(ev.pageX - sx) + Math.abs(ev.pageY - sy) <= 4) return
      moved = true
      const dx = ev.pageX - sx
      const dy = ev.pageY - sy
      setDragging((prev) => ({
        ...prev,
        [n.id]: {
          x: from.x + dx,
          y: from.y + dy,
          rect: fromRect ? { ...fromRect, x: fromRect.x + dx, y: fromRect.y + dy } : undefined,
        },
      }))
    }
    const up = () => {
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", up)
      const at = dragging()[n.id]
      if (!moved || !at) {
        setOpen(open() === n.id ? null : n.id)
        return
      }
      const { w, h } = size()
      persist(
        notes().map((x) =>
          x.id === n.id
            ? {
                ...x,
                coords: { x: at.x / w, y: at.y / h },
                ...(at.rect
                  ? {
                      rect: {
                        x: at.rect.x / w,
                        y: at.rect.y / h,
                        w: at.rect.w / w,
                        h: at.rect.h / h,
                      },
                    }
                  : {}),
              }
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
              <>
                {/* The region is the note's subject; it brightens with its thread. */}
                <Show when={rectAt(n)}>
                  {(r) => (
                    <div
                      class={`pointer-events-none absolute rounded-md border-2 transition-colors duration-200 ${
                        open() === n.id
                          ? "border-amber-400/80 bg-amber-400/10"
                          : "border-amber-400/25 bg-amber-400/[0.04]"
                      }`}
                      style={{
                        left: `${r().x}px`,
                        top: `${r().y}px`,
                        width: `${r().w}px`,
                        height: `${r().h}px`,
                      }}
                    />
                  )}
                </Show>
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
              </>
            )
          }}
        </For>

        {/* The region being drawn, before it is anybody's note. */}
        <Show when={marquee()}>
          {(r) => (
            <div
              class="pointer-events-none absolute rounded-md border-2 border-amber-400/80 bg-amber-400/10"
              style={{
                left: `${r().x}px`,
                top: `${r().y}px`,
                width: `${r().w}px`,
                height: `${r().h}px`,
              }}
            />
          )}
        </Show>

        <Show when={draft()}>
          {(d) => {
            // The ghost the cursor was carrying becomes a real pin the moment
            // the spot is chosen, and the composer hangs off that pin. Without
            // it the note has no visible target while it is being written.
            let dropEl: HTMLSpanElement | undefined
            return (
              <>
                <Show when={d().rect}>
                  {(r) => (
                    <div
                      class="pointer-events-none absolute rounded-md border-2 border-amber-400/80 bg-amber-400/10"
                      style={{
                        left: `${r().x}px`,
                        top: `${r().y}px`,
                        width: `${r().w}px`,
                        height: `${r().h}px`,
                      }}
                    />
                  )}
                </Show>
                <span
                  ref={dropEl}
                  class="pointer-events-none absolute"
                  style={{
                    left: `${d().x}px`,
                    top: `${d().y}px`,
                    transform: "translate(-50%, -50%)",
                  }}
                >
                  <span class="pin-drop block">
                    <Pin label={String(openNotes().length + 1)} />
                  </span>
                </span>
                <Floater anchor={() => dropEl} keepOut={KEEP_OUT} class="note-opaque">
                  <div class="glass pointer-events-auto w-80 max-w-full rounded-2xl p-4">
                    <div class="mb-2 font-mono text-base text-zinc-400">
                      {d().selector}
                      <Show when={d().rect}> · region</Show>
                    </div>
                    <div class="flex items-center gap-2">
                      <input
                        // Focus after the frame the popover is promoted in: a
                        // popover is display:none until then, and hidden
                        // elements cannot take focus.
                        ref={(el) => requestAnimationFrame(() => el.focus())}
                        value={text()}
                        onInput={(e) => setText(e.currentTarget.value)}
                        onKeyDown={(e) => e.key === "Enter" && commit()}
                        placeholder="What feels off?"
                        class="min-w-0 flex-1 rounded-xl bg-black/[0.04] px-3 py-2 text-base outline-none placeholder:text-zinc-400"
                      />
                      {/* Send. Enter is a shortcut, never the only door: a
                          thumb cannot press a key it does not have. */}
                      <button
                        type="button"
                        aria-label="Save note"
                        disabled={!text().trim()}
                        // Keep the caret where it is; the press must not blur
                        // the field it is submitting.
                        onPointerDown={(e) => e.preventDefault()}
                        onClick={commit}
                        class="grid size-9 shrink-0 cursor-pointer place-items-center rounded-full bg-amber-400 text-white shadow-[0_2px_10px_rgba(217,119,6,0.45)] transition-all hover:scale-105 active:scale-95 disabled:cursor-default disabled:bg-black/[0.06] disabled:text-zinc-400 disabled:shadow-none disabled:hover:scale-100"
                      >
                        <ArrowUp size={18} stroke-width={2.75} />
                      </button>
                    </div>
                    <div class="mt-2 flex items-center justify-between font-mono text-base text-zinc-300">
                      <span class="max-sm:invisible">enter to save</span>
                      <button
                        type="button"
                        class="cursor-pointer hover:text-zinc-500"
                        onClick={discard}
                      >
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
