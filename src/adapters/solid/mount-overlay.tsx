import { For, Show, createResource, createSignal, onCleanup, onMount } from "solid-js"
import { render } from "solid-js/web"
import { fetchNotes, moveNote, postNote, replyNote, resolveNote, selectorWithin } from "../client"
import type { SteerNote } from "../../core/model"
import { parseStateUrl } from "../../core/state-url"
import { STEER_COMPONENT_ATTR, STEER_PROPS_ATTR, slugFromComponentName } from "../stamp-attr"
import { Peek } from "./chrome/Peek"
import { Pin } from "./chrome/Pin"
import { GhostPin } from "./chrome/GhostPin"
import { NoteThread } from "./chrome/NoteThread"
import { Floater } from "./chrome/Floater"
import { bandOf } from "./chrome/bands"

const AUTHOR = "andres"

/** Viewport margins a floating panel may not cross. The bottom clears the
 *  peek bar, which is the one piece of chrome that sits over the page. */
const KEEP_OUT = { top: 16, right: 16, bottom: 92, left: 16 }

function routeSlug(path: string): string {
  if (path === "/" || path === "") return "page"
  return `page-${path.replace(/^\//, "").replace(/\//g, "-")}`
}

function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (seconds < 60) return "now"
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`
  return `${Math.floor(seconds / 86400)}d`
}

function isOverlay(el: EventTarget | null): boolean {
  if (!(el instanceof Node)) return false
  // Floating panels are portalled to <body>, so they are chrome without being
  // inside the overlay root.
  if (el instanceof Element && el.closest("[data-steer-floater]")) return true
  return !!document.getElementById("steer-overlay")?.contains(el)
}

function hostOf(el: HTMLElement): { slug: string; props: Record<string, string>; el: HTMLElement } | undefined {
  const host = el.closest(`[${STEER_COMPONENT_ATTR}]`)
  if (!(host instanceof HTMLElement)) return
  const name = host.getAttribute(STEER_COMPONENT_ATTR)
  if (!name) return
  let props: Record<string, string> = {}
  const raw = host.getAttribute(STEER_PROPS_ATTR)
  if (raw) {
    try {
      props = JSON.parse(raw) as Record<string, string>
    } catch {
      /* ignore malformed stamps */
    }
  }
  return { slug: slugFromComponentName(name), props, el: host }
}

async function loadLiveNotes(): Promise<SteerNote[]> {
  const names = [
    ...new Set(
      [...document.querySelectorAll(`[${STEER_COMPONENT_ATTR}]`)].map(
        (n) => n.getAttribute(STEER_COMPONENT_ATTR) ?? "",
      ),
    ),
  ].filter(Boolean)
  const slugs = [...new Set([routeSlug(location.pathname), ...names.map(slugFromComponentName)])]
  const batches = await Promise.all(slugs.map((s) => fetchNotes(s)))
  return batches.flat()
}

function OverlayApp() {
  const pageSlug = () => routeSlug(location.pathname)
  const [notes, { mutate }] = createResource(loadLiveNotes)
  const [open, setOpen] = createSignal(false)
  const [noteMode, setNoteMode] = createSignal(false)
  const [pinsVisible, setPinsVisible] = createSignal(false)
  const [width, setWidth] = createSignal(window.innerWidth)
  const [hover, setHover] = createSignal<{ x: number; y: number } | undefined>()
  const [pending, setPending] = createSignal<
    | {
        selector: string
        coords: { x: number; y: number }
        client: { x: number; y: number }
        dest: string
        stateUrl: string
      }
    | undefined
  >()
  const [draft, setDraft] = createSignal("")
  const [openPin, setOpenPin] = createSignal<string | undefined>()
  const [reply, setReply] = createSignal("")
  // Pins held by the cursor, in client space, keyed by note id.
  const [dragging, setDragging] = createSignal<Record<string, { x: number; y: number }>>({})

  const band = () => bandOf(width()).id
  const openNotes = () => (notes() ?? []).filter((n) => n.status === "open")
  const noteMatches = (n: SteerNote) =>
    n.stateUrl.startsWith("/__steer/") || parseStateUrl(n.stateUrl).values.band === band()
  const here = () => openNotes().filter(noteMatches).length
  const away = () => openNotes().length - here()

  const arm = (on: boolean) => {
    setNoteMode(on)
    setPending(undefined)
    setDraft("")
    document.body.classList.toggle("steer-noting", on)
    if (on) {
      setOpen(true)
      setPinsVisible(true)
      setOpenPin(undefined)
    }
  }

  /** The element a note hangs off, when its selector still resolves. */
  const anchorOf = (n: SteerNote): Element | null => {
    if (!n.selector || n.selector.startsWith("(")) return null
    try {
      return document.querySelector(n.selector)
    } catch {
      return null
    }
  }

  const pinAt = (n: SteerNote) => {
    // Mid-drag the pin lives in client space, so it tracks the cursor exactly
    // instead of round-tripping through its anchor's fractions every frame.
    const held = dragging()[n.id]
    if (held) return held
    const el = anchorOf(n)
    if (el) {
      const box = el.getBoundingClientRect()
      return {
        x: box.left + n.coords.x * box.width,
        y: box.top + n.coords.y * box.height,
      }
    }
    return { x: n.coords.x * width(), y: n.coords.y * window.innerHeight }
  }

  /** Client point → the fractions of its anchor that pinAt reads back. */
  const coordsAt = (n: SteerNote, at: { x: number; y: number }) => {
    const el = anchorOf(n)
    if (el) {
      const box = el.getBoundingClientRect()
      return {
        x: box.width ? (at.x - box.left) / box.width : 0.5,
        y: box.height ? (at.y - box.top) / box.height : 0.5,
      }
    }
    return { x: at.x / width(), y: at.y / window.innerHeight }
  }

  /**
   * Drag a pin to re-place it. A press that never travels is still a click:
   * it opens the thread. Anything past the threshold moves the note and
   * commits the new coords to the note file.
   */
  const onPinDrag = (n: SteerNote) => (e: PointerEvent) => {
    e.stopPropagation()
    // While composing, pins are inert — the press belongs to the new note.
    if (noteMode()) return
    e.preventDefault()
    const sx = e.clientX
    const sy = e.clientY
    let moved = false
    const move = (ev: PointerEvent) => {
      if (!moved && Math.abs(ev.clientX - sx) + Math.abs(ev.clientY - sy) <= 4) return
      moved = true
      setDragging((prev) => ({ ...prev, [n.id]: { x: ev.clientX, y: ev.clientY } }))
    }
    const up = async () => {
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", up)
      const at = dragging()[n.id]
      if (!moved || !at) {
        setOpenPin(openPin() === n.id ? undefined : n.id)
        return
      }
      const saved = await moveNote(n.component || pageSlug(), n.id, coordsAt(n, at))
      mutate((prev) => (prev ?? []).map((x) => (x.id === n.id ? saved : x)))
      setDragging((prev) => {
        const next = { ...prev }
        delete next[n.id]
        return next
      })
    }
    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", up)
  }

  const onResize = () => setWidth(window.innerWidth)

  const onKey = (e: KeyboardEvent) => {
    const t = e.target as HTMLElement
    if (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable) {
      if (e.key === "Escape") {
        setPending(undefined)
        arm(false)
      }
      return
    }
    if (e.key === "c" && !e.metaKey && !e.ctrlKey) arm(!noteMode())
    if (e.key === "Escape") {
      if (pending() || noteMode()) {
        setPending(undefined)
        arm(false)
        return
      }
      setOpenPin(undefined)
      setOpen(false)
      setPinsVisible(false)
    }
  }

  const onMove = (e: PointerEvent) => {
    if (!noteMode() || pending()) return
    if (isOverlay(e.target)) {
      setHover(undefined)
      return
    }
    setHover({ x: e.clientX, y: e.clientY })
  }

  const onDown = (e: PointerEvent) => {
    if (!noteMode() || pending()) return
    if (isOverlay(e.target)) return
    e.preventDefault()
    e.stopPropagation()
    const hit = document.elementFromPoint(e.clientX, e.clientY)
    const el = hit instanceof HTMLElement && !isOverlay(hit) ? hit : document.body
    const host = hostOf(el)
    const target = host?.el ?? el
    const box = target.getBoundingClientRect()
    const dest = host?.slug ?? pageSlug()
    const stateUrl = host
      ? `/__steer/${host.slug}${Object.keys(host.props).length ? `?${new URLSearchParams(host.props)}` : ""}`
      : `${location.pathname}?band=${band()}`
    setPending({
      selector: selectorWithin(document.documentElement, target),
      coords: {
        x: box.width ? (e.clientX - box.left) / box.width : 0.5,
        y: box.height ? (e.clientY - box.top) / box.height : 0.5,
      },
      client: { x: e.clientX, y: e.clientY },
      dest,
      stateUrl,
    })
    setDraft("")
    setNoteMode(false)
    document.body.classList.remove("steer-noting")
    setHover(undefined)
  }

  const commit = async () => {
    const p = pending()
    const text = draft().trim()
    if (!p || !text) return
    const saved = await postNote(p.dest, {
      stateUrl: p.stateUrl,
      selector: p.selector,
      coords: p.coords,
      text,
      author: AUTHOR,
    })
    mutate((prev) => [...(prev ?? []), saved])
    setPending(undefined)
    setDraft("")
    setOpenPin(saved.id)
  }

  onMount(() => {
    window.addEventListener("resize", onResize)
    window.addEventListener("keydown", onKey)
    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerdown", onDown, true)
  })
  onCleanup(() => {
    window.removeEventListener("resize", onResize)
    window.removeEventListener("keydown", onKey)
    window.removeEventListener("pointermove", onMove)
    window.removeEventListener("pointerdown", onDown, true)
    document.body.classList.remove("steer-noting")
  })

  return (
    <>
      <style>{`body.steer-noting, body.steer-noting * { cursor: crosshair !important; } body.steer-noting #steer-overlay, body.steer-noting #steer-overlay * { cursor: pointer !important; }`}</style>
      <Show when={pinsVisible()}>
        <For each={openNotes()}>
          {(n, i) => {
            // The thread hangs off this node, so the Floater needs it by ref.
            let pinEl: HTMLDivElement | undefined
            return (
              <div
                ref={pinEl}
                class="fixed z-[70]"
                style={{
                  left: `${(width(), pinAt(n).x)}px`,
                  top: `${pinAt(n).y}px`,
                  transform: "translate(-50%, -50%)",
                }}
              >
                <Pin
                  label={String(i() + 1)}
                  author={n.author === "agent" ? "agent" : "human"}
                  matchesState={noteMatches(n)}
                  onPointerDown={onPinDrag(n)}
                />
                <Show when={openPin() === n.id && noteMatches(n)}>
                  <Floater anchor={() => pinEl} keepOut={KEEP_OUT}>
                    <NoteThread
                      author={n.author}
                      createdLabel={timeAgo(n.created)}
                      text={n.text}
                      replies={(n.replies ?? []).map((r) => ({
                        author: r.author,
                        createdLabel: timeAgo(r.created),
                        text: r.text,
                      }))}
                      replyValue={reply()}
                      onResolve={async () => {
                        setOpenPin(undefined)
                        mutate((prev) =>
                          (prev ?? []).map((x) => (x.id === n.id ? { ...x, status: "resolved" as const } : x)),
                        )
                        await resolveNote(n.component || pageSlug(), n.id)
                      }}
                      onReplyInput={setReply}
                      onReply={async () => {
                        const text = reply().trim()
                        if (!text) return
                        setReply("")
                        const saved = await replyNote(n.component || pageSlug(), n.id, text, AUTHOR)
                        mutate((prev) => (prev ?? []).map((x) => (x.id === n.id ? saved : x)))
                      }}
                    />
                  </Floater>
                </Show>
              </div>
            )
          }}
        </For>
      </Show>
      <Show when={noteMode() && hover()}>
        {(h) => (
          <div class="pointer-events-none fixed z-[75]" style={{ left: `${h().x}px`, top: `${h().y}px`, transform: "translate(-50%, -50%)" }}>
            <GhostPin />
          </div>
        )}
      </Show>
      <Show when={pending()}>
        {(p) => (
          <Floater anchor={() => p().client} keepOut={KEEP_OUT}>
            <div class="glass w-80 rounded-2xl p-4">
              <textarea
                class="h-20 w-full resize-none bg-transparent text-base leading-relaxed text-zinc-800 outline-none placeholder:text-zinc-300"
                placeholder="What feels off?"
                value={draft()}
                onInput={(e) => setDraft(e.currentTarget.value)}
                onKeyDown={(e) => {
                  e.stopPropagation()
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    void commit()
                  }
                  if (e.key === "Escape") {
                    setPending(undefined)
                    arm(false)
                  }
                }}
                ref={(el) => requestAnimationFrame(() => el.focus())}
              />
              <div class="mt-2 flex items-center justify-between">
                <span class="max-w-36 truncate font-mono text-base text-zinc-300">{p().selector.split(" > ").pop()}</span>
                <div class="flex gap-4">
                  <button
                    type="button"
                    class="cursor-pointer text-base text-zinc-400 hover:text-zinc-900"
                    onClick={() => {
                      setPending(undefined)
                      arm(false)
                    }}
                  >
                    cancel
                  </button>
                  <button
                    type="button"
                    class="cursor-pointer text-base font-semibold text-zinc-900 hover:text-zinc-500"
                    onClick={() => void commit()}
                  >
                    pin
                  </button>
                </div>
              </div>
            </div>
          </Floater>
        )}
      </Show>
      <Peek
        count={openNotes().length}
        expanded={open()}
        noteMode={noteMode()}
        pinsVisible={pinsVisible()}
        width={width()}
        band={band()}
        here={here()}
        away={away()}
        benchHref="/__steer"
        placement="fixed"
        onToggle={() => {
          const next = !open()
          setOpen(next)
          setPinsVisible(next)
          if (!next) {
            arm(false)
            setOpenPin(undefined)
          }
        }}
        onAddNote={() => arm(!noteMode())}
        onTogglePins={() => setPinsVisible(!pinsVisible())}
      />
    </>
  )
}

/** Injected by the Vite plugin. Never imported by the host app. */
export function mountOverlay(): void {
  if (document.getElementById("steer-overlay")) return
  const el = document.createElement("div")
  el.id = "steer-overlay"
  document.body.append(el)
  render(() => <OverlayApp />, el)
}
