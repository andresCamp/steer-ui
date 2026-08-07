import {
  createMemo,
  createResource,
  createSignal,
  For,
  onCleanup,
  Show,
  Suspense,
  type JSX,
} from "solid-js"
import { Dynamic } from "solid-js/web"
import { A, useNavigate, useParams, useSearchParams } from "@solidjs/router"
import Plus from "lucide-solid/icons/plus"
import Minus from "lucide-solid/icons/minus"
import Link2 from "lucide-solid/icons/link-2"
import Check from "lucide-solid/icons/check"
import MessageSquarePlus from "lucide-solid/icons/message-square-plus"
import RotateCcw from "lucide-solid/icons/rotate-ccw"
import ArrowLeft from "lucide-solid/icons/arrow-left"
import {
  coerceProps,
  fetchFixture,
  fetchManifest,
  fetchNotes,
  moveNote,
  postNote,
  replyNote,
  resolveComponent,
  resolveNote,
  selectorWithin,
  stateUrl,
  stringifyFixtureValues,
  type BenchComponentSpec,
  type BenchNote,
  type BenchProp,
} from "./data"

const ZOOM_MIN = 0.25
const ZOOM_MAX = 4
const LN_MIN = Math.log(ZOOM_MIN)
const LN_MAX = Math.log(ZOOM_MAX)

/** Compact relative timestamp: now, 5m, 3h, 2d. */
function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (seconds < 60) return "now"
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`
  return `${Math.floor(seconds / 86400)}d`
}

// --- knob controls ---------------------------------------------------------

function Knob(props: {
  prop: BenchProp
  value: string | undefined
  onChange: (value: string) => void
}) {
  const control = (): JSX.Element => {
    switch (props.prop.kind) {
      case "enum":
        return (
          <div
            class="grid rounded-xl bg-black/[0.04] p-1"
            style={{
              "grid-template-columns": `repeat(${
                (props.prop.options?.length ?? 1) > 3 ? 2 : props.prop.options?.length ?? 1
              }, 1fr)`,
            }}
          >
            <For each={props.prop.options}>
              {(option) => (
                <button
                  type="button"
                  class={`cursor-pointer truncate rounded-lg px-2 py-1.5 font-mono text-base transition-colors ${
                    props.value === option
                      ? "bg-white text-zinc-900 shadow-[0_1px_4px_rgba(0,0,0,0.12)]"
                      : "text-zinc-400 hover:text-zinc-700"
                  }`}
                  onClick={() => props.onChange(option)}
                >
                  {option}
                </button>
              )}
            </For>
          </div>
        )
      case "boolean":
        return (
          <button
            type="button"
            role="switch"
            aria-checked={props.value === "true"}
            class={`relative h-[26px] w-11 cursor-pointer rounded-full transition-colors duration-200 ${
              props.value === "true" ? "bg-zinc-900" : "bg-black/[0.12]"
            }`}
            onClick={() => props.onChange(props.value === "true" ? "false" : "true")}
          >
            <span
              class={`absolute top-[3px] size-5 rounded-full bg-white shadow-sm transition-[left] duration-200 ${
                props.value === "true" ? "left-[21px]" : "left-[3px]"
              }`}
            />
          </button>
        )
      case "string":
      case "children":
        return (
          <input
            type="text"
            class="h-10 w-full rounded-lg bg-black/[0.04] px-3 font-mono text-base text-zinc-800 outline-none transition-colors placeholder:text-zinc-300 focus:bg-black/[0.06]"
            value={props.value ?? ""}
            onInput={(e) => props.onChange(e.currentTarget.value)}
          />
        )
      case "number":
        return (
          <input
            type="number"
            class="h-10 w-24 rounded-lg bg-black/[0.04] px-3 font-mono text-base text-zinc-800 outline-none focus:bg-black/[0.06]"
            value={props.value ?? ""}
            onInput={(e) => props.onChange(e.currentTarget.value)}
          />
        )
      default:
        return null
    }
  }

  return (
    <Show when={props.prop.kind !== "unsupported"}>
      <div
        class="flex flex-col gap-2 py-3"
        title={
          props.prop.description ? `${props.prop.description} · ${props.prop.raw}` : props.prop.raw
        }
      >
        <span class="text-base font-medium text-zinc-500">{props.prop.name}</span>
        {control()}
      </div>
    </Show>
  )
}

// --- page ------------------------------------------------------------------

export function BenchComponent() {
  const params = useParams()
  const [searchParams, setSearchParams] = useSearchParams()

  const [manifest] = createResource(fetchManifest)
  const [fixture] = createResource(() => params.slug, fetchFixture)
  const [notes, { mutate: mutateNotes }] = createResource(() => params.slug, fetchNotes)

  const spec = createMemo<BenchComponentSpec | undefined>(() =>
    manifest()?.components.find((c) => c.slug === params.slug)
  )

  const fixtureState = (name: string): Record<string, string> =>
    stringifyFixtureValues(fixture()?.states?.[name] ?? {})

  const knobValues = createMemo<Record<string, string>>(() => {
    const base: Record<string, string> = { ...fixtureState("default") }
    for (const [key, value] of Object.entries(searchParams)) {
      if (typeof value === "string") base[key] = value
    }
    return base
  })

  const componentProps = createMemo(() => {
    const s = spec()
    return s ? coerceProps(s, knobValues()) : {}
  })

  const currentUrl = createMemo(() => stateUrl(params.slug, knobValues()))

  const activeFixtureState = createMemo(() => {
    const current = JSON.stringify(knobValues())
    for (const name of Object.keys(fixture()?.states ?? {})) {
      if (JSON.stringify({ ...fixtureState("default"), ...fixtureState(name) }) === current) {
        return name
      }
    }
    return undefined
  })

  // --- canvas state --------------------------------------------------------

  const [pan, setPan] = createSignal({ x: 0, y: 0 })
  const [zoom, setZoom] = createSignal(1)
  const [navigating, setNavigating] = createSignal(false)
  const [animating, setAnimating] = createSignal(false)
  let canvasRef: HTMLDivElement | undefined
  let stageRef: HTMLDivElement | undefined
  let trackRef: HTMLDivElement | undefined
  let navTimer: ReturnType<typeof setTimeout> | undefined
  let dragMoved = false

  const touchNav = () => {
    setNavigating(true)
    clearTimeout(navTimer)
    navTimer = setTimeout(() => setNavigating(false), 350)
  }

  const clampZoom = (z: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z))

  const zoomAt = (clientX: number, clientY: number, nextZoom: number) => {
    if (!canvasRef) return
    const rect = canvasRef.getBoundingClientRect()
    const cx = clientX - rect.left - rect.width / 2
    const cy = clientY - rect.top - rect.height / 2
    const z = zoom()
    const nz = clampZoom(nextZoom)
    // Keep the point under the cursor stationary while scaling.
    setPan((p) => ({
      x: cx - ((cx - p.x) * nz) / z,
      y: cy - ((cy - p.y) * nz) / z,
    }))
    setZoom(nz)
    touchNav()
  }

  /** Zoom anchored to the canvas center (buttons, slider). */
  const zoomCenter = (nextZoom: number, animate = false) => {
    if (!canvasRef) return
    const rect = canvasRef.getBoundingClientRect()
    if (animate) {
      setAnimating(true)
      setTimeout(() => setAnimating(false), 220)
    }
    zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, nextZoom)
  }

  const resetView = () => {
    setAnimating(true)
    setPan({ x: 0, y: 0 })
    setZoom(1)
    setTimeout(() => setAnimating(false), 260)
  }

  const onWheel = (e: WheelEvent) => {
    e.preventDefault()
    if (e.ctrlKey || e.metaKey) {
      zoomAt(e.clientX, e.clientY, zoom() * Math.exp(-e.deltaY * 0.01))
    } else {
      setPan((p) => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }))
      touchNav()
    }
  }

  // The canvas mounts lazily inside Suspense, so the listener attaches via
  // the ref callback rather than onMount.
  const setCanvasRef = (el: HTMLDivElement) => {
    canvasRef = el
    el.addEventListener("wheel", onWheel, { passive: false })
    onCleanup(() => el.removeEventListener("wheel", onWheel))
  }

  /** Client point → stage-relative fractions (may exceed 0..1 off-component). */
  const stageRel = (clientX: number, clientY: number) => {
    const rect = stageRef!.getBoundingClientRect()
    return {
      x: (clientX - rect.left) / rect.width,
      y: (clientY - rect.top) / rect.height,
    }
  }

  /** Notes can land on the component or the empty canvas, never on chrome. */
  const isNotable = (t: HTMLElement) =>
    t.hasAttribute("data-canvas-bg") || (stageRef?.contains(t) ?? false)

  const onPointerDown = (e: PointerEvent) => {
    const target = e.target as HTMLElement

    // Note mode: click drops a pin, drag highlights a region. Anywhere on
    // the canvas counts; floating chrome does not.
    if (noteMode()) {
      if (!stageRef || pending() || !isNotable(target)) return
      e.preventDefault()
      const startClientX = e.clientX
      const startClientY = e.clientY
      const start = stageRel(e.clientX, e.clientY)
      let dragged = false
      const move = (ev: PointerEvent) => {
        if (Math.abs(ev.clientX - startClientX) + Math.abs(ev.clientY - startClientY) > 6) {
          dragged = true
        }
        const cur = stageRel(ev.clientX, ev.clientY)
        if (!dragged) {
          setHoverPin(cur)
          return
        }
        const region = {
          x: Math.min(start.x, cur.x),
          y: Math.min(start.y, cur.y),
          w: Math.abs(cur.x - start.x),
          h: Math.abs(cur.y - start.y),
        }
        setRegionDrag(region)
        // Ghost pin previews its final perch: the region's top-right corner.
        setHoverPin({ x: region.x + region.w, y: region.y })
      }
      const up = (ev: PointerEvent) => {
        window.removeEventListener("pointermove", move)
        window.removeEventListener("pointerup", up)
        const cur = stageRel(ev.clientX, ev.clientY)
        const upTarget = ev.target as HTMLElement
        const selector =
          stageRef && stageRef.contains(upTarget)
            ? selectorWithin(stageRef, upTarget)
            : "(canvas)"
        const region = dragged ? regionDrag() : undefined
        setPending({
          // Region notes anchor their pin to the region's top-right corner.
          coords: region ? { x: region.x + region.w, y: region.y } : cur,
          selector,
          rect: region,
        })
        setRegionDrag(undefined)
        setHoverPin(undefined)
      }
      window.addEventListener("pointermove", move)
      window.addEventListener("pointerup", up)
      return
    }

    // Any press outside an open note closes it (pins and popovers stop
    // propagation, so reaching here means the press was elsewhere).
    setOpenPin(undefined)

    // Pan only when the drag starts on empty canvas, never on the component
    // or floating chrome.
    if (!target.hasAttribute("data-canvas-bg")) return
    dragMoved = false
    const startX = e.clientX
    const startY = e.clientY
    const origin = pan()
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - startX
      const dy = ev.clientY - startY
      if (Math.abs(dx) + Math.abs(dy) > 3) dragMoved = true
      setPan({ x: origin.x + dx, y: origin.y + dy })
      touchNav()
    }
    const up = () => {
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", up)
    }
    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", up)
  }

  // --- zoom tape: a tick surface that scrolls under a fixed cursor --------

  const TAPE_H = 208
  const PX_PER_LN = 88
  const TICK_STEP = 0.125
  const TICKS: number[] = []
  for (let v = LN_MIN; v <= LN_MAX + 1e-9; v += TICK_STEP) TICKS.push(v)

  /** Vertical position of a tick for the current zoom; center = current. */
  const tickY = (v: number) => TAPE_H / 2 - (v - Math.log(zoom())) * PX_PER_LN

  const tickStyle = (v: number) => {
    const y = tickY(v)
    const dist = Math.abs(y - TAPE_H / 2)
    const falloff = Math.max(0, 1 - dist / (TAPE_H / 2))
    const major = Math.abs(v / 0.5 - Math.round(v / 0.5)) < 1e-6
    return {
      top: `${y}px`,
      // Fade toward the ends but never fully vanish inside the tape, so the
      // tick field runs edge to edge.
      opacity: `${0.16 + Math.pow(falloff, 1.6) * 0.84}`,
      width: `${(major ? 18 : 10) + falloff * 10}px`,
      display: y < -2 || y > TAPE_H + 2 ? "none" : "block",
    }
  }

  const onTapePointerDown = (e: PointerEvent) => {
    e.preventDefault()
    const startY = e.clientY
    const startLn = Math.log(zoom())
    const move = (ev: PointerEvent) => {
      // Drag up pulls the tape toward higher magnification.
      zoomCenter(Math.exp(startLn + (startY - ev.clientY) / PX_PER_LN))
    }
    const up = () => {
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", up)
    }
    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", up)
  }

  /** Scrolling on the tape zooms too; stop it reaching the canvas pan. */
  const setTapeRef = (el: HTMLDivElement) => {
    trackRef = el
    const onTapeWheel = (e: WheelEvent) => {
      e.preventDefault()
      e.stopPropagation()
      zoomCenter(zoom() * Math.exp(-e.deltaY * 0.005))
    }
    el.addEventListener("wheel", onTapeWheel, { passive: false })
    onCleanup(() => el.removeEventListener("wheel", onTapeWheel))
  }

  // --- draggable pins ------------------------------------------------------

  const [pinOverride, setPinOverride] = createSignal<
    Record<
      string,
      {
        coords: { x: number; y: number }
        rect?: { x: number; y: number; w: number; h: number }
      }
    >
  >({})

  const pinCoords = (note: BenchNote) => pinOverride()[note.id]?.coords ?? note.coords
  const pinRect = (note: BenchNote) => {
    const override = pinOverride()[note.id]
    return override ? override.rect : note.rect
  }

  /** Resize a note's region by dragging a corner; the opposite corner anchors. */
  const onRegionResize = (note: BenchNote, cornerX: 0 | 1, cornerY: 0 | 1) => (e: PointerEvent) => {
    e.stopPropagation()
    e.preventDefault()
    const r0 = note.rect
    if (!r0) return
    const anchor = { x: r0.x + (1 - cornerX) * r0.w, y: r0.y + (1 - cornerY) * r0.h }
    let moved = false
    const move = (ev: PointerEvent) => {
      moved = true
      const cur = stageRel(ev.clientX, ev.clientY)
      const nextRect = {
        x: Math.min(anchor.x, cur.x),
        y: Math.min(anchor.y, cur.y),
        w: Math.abs(cur.x - anchor.x),
        h: Math.abs(cur.y - anchor.y),
      }
      setPinOverride((prev) => ({
        ...prev,
        [note.id]: {
          // The pin stays perched on the region's top-right corner.
          coords: { x: nextRect.x + nextRect.w, y: nextRect.y },
          rect: nextRect,
        },
      }))
    }
    const up = async () => {
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", up)
      if (!moved) return
      const override = pinOverride()[note.id]
      if (override?.rect) {
        const saved = await moveNote(params.slug, note.id, override.coords, override.rect)
        mutateNotes((prev) => (prev ?? []).map((n) => (n.id === note.id ? saved : n)))
        setPinOverride((prev) => {
          const next = { ...prev }
          delete next[note.id]
          return next
        })
      }
    }
    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", up)
  }

  /** Drag a whole note (pin and its region move together) from either handle. */
  const onNoteDrag = (note: BenchNote) => (e: PointerEvent) => {
    // While composing a note, existing pins are inert: the click falls
    // through to the canvas and places the new note instead.
    if (noteMode()) return
    e.stopPropagation()
    e.preventDefault()
    const startX = e.clientX
    const startY = e.clientY
    const origCoords = note.coords
    const origRect = note.rect
    let moved = false
    const move = (ev: PointerEvent) => {
      if (Math.abs(ev.clientX - startX) + Math.abs(ev.clientY - startY) > 4) moved = true
      if (!moved || !stageRef) return
      const rect = stageRef.getBoundingClientRect()
      const dx = (ev.clientX - startX) / rect.width
      const dy = (ev.clientY - startY) / rect.height
      setPinOverride((prev) => ({
        ...prev,
        [note.id]: {
          coords: { x: origCoords.x + dx, y: origCoords.y + dy },
          rect: origRect ? { ...origRect, x: origRect.x + dx, y: origRect.y + dy } : undefined,
        },
      }))
    }
    const up = async () => {
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", up)
      if (moved) {
        const override = pinOverride()[note.id]
        if (override) {
          const saved = await moveNote(params.slug, note.id, override.coords, override.rect)
          mutateNotes((prev) => (prev ?? []).map((n) => (n.id === note.id ? saved : n)))
          setPinOverride((prev) => {
            const next = { ...prev }
            delete next[note.id]
            return next
          })
        }
      } else if (noteMatchesState(note)) {
        setOpenPin(openPin() === note.id ? undefined : note.id)
      } else {
        // A pin from another state: jump to the state it was written against.
        navigate(note.stateUrl)
        setOpenPin(note.id)
      }
    }
    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", up)
  }

  // --- notes ---------------------------------------------------------------

  const [noteMode, setNoteMode] = createSignal(false)
  const [pending, setPending] = createSignal<
    | {
        coords: { x: number; y: number }
        selector: string
        rect?: { x: number; y: number; w: number; h: number }
      }
    | undefined
  >()
  const [noteText, setNoteText] = createSignal("")
  const [hoverPin, setHoverPin] = createSignal<{ x: number; y: number } | undefined>()
  const [regionDrag, setRegionDrag] = createSignal<
    { x: number; y: number; w: number; h: number } | undefined
  >()

  const handleCanvasMouseMove = (e: MouseEvent) => {
    if (!noteMode() || pending() || !stageRef) return
    if (!isNotable(e.target as HTMLElement)) {
      setHoverPin(undefined)
      return
    }
    setHoverPin(stageRel(e.clientX, e.clientY))
  }

  const submitNote = async () => {
    const p = pending()
    if (!p || !noteText().trim()) return
    const saved = await postNote(params.slug, {
      stateUrl: currentUrl(),
      selector: p.selector,
      coords: p.coords,
      rect: p.rect,
      text: noteText().trim(),
      author: "andres",
    })
    mutateNotes((prev) => [...(prev ?? []), saved])
    setPending(undefined)
    setNoteText("")
    setNoteMode(false)
  }

  const handleResolve = async (id: string) => {
    setOpenPin(undefined)
    mutateNotes((prev) =>
      (prev ?? []).map((n) => (n.id === id ? { ...n, status: "resolved" as const } : n))
    )
    await resolveNote(params.slug, id)
  }

  const [replyText, setReplyText] = createSignal("")
  const submitReply = async (note: BenchNote) => {
    const text = replyText().trim()
    if (!text) return
    setReplyText("")
    const saved = await replyNote(params.slug, note.id, text, "andres")
    mutateNotes((prev) => (prev ?? []).map((n) => (n.id === note.id ? saved : n)))
  }

  const [copied, setCopied] = createSignal(false)
  const copyUrl = () => {
    navigator.clipboard.writeText(location.origin + currentUrl())
    setCopied(true)
    setTimeout(() => setCopied(false), 1200)
  }

  const openNotes = () => (notes() ?? []).filter((n) => n.status === "open")
  const [openPin, setOpenPin] = createSignal<string | undefined>()
  const navigate = useNavigate()

  /** Does a note belong to the knob state currently on screen? */
  const noteMatchesState = (note: BenchNote) => {
    const query = note.stateUrl.split("?")[1] ?? ""
    const noteValues: Record<string, string> = {}
    new URLSearchParams(query).forEach((value, key) => (noteValues[key] = value))
    const current = knobValues()
    const keys = new Set([...Object.keys(current), ...Object.keys(noteValues)])
    for (const key of keys) {
      if ((current[key] ?? "") !== (noteValues[key] ?? "")) return false
    }
    return true
  }

  // Hotkey: "c" toggles note mode (unless typing in a field).
  const onKey = (e: KeyboardEvent) => {
    const t = e.target as HTMLElement
    if (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable) return
    if (e.key === "c" && !e.metaKey && !e.ctrlKey) {
      setNoteMode(!noteMode())
      setPending(undefined)
    }
    if (e.key === "Escape") {
      setNoteMode(false)
      setPending(undefined)
      setOpenPin(undefined)
    }
  }
  window.addEventListener("keydown", onKey)
  onCleanup(() => window.removeEventListener("keydown", onKey))

  return (
    <Suspense>
      <Show
        when={spec()}
        fallback={<p class="p-10 font-mono text-base text-zinc-400">no component "{params.slug}"</p>}
      >
        {(s) => (
          <div
            class={`relative h-screen overflow-hidden ${
              noteMode() && hoverPin() ? "cursor-none" : ""
            }`}
            ref={setCanvasRef}
            onPointerDown={onPointerDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseLeave={() => setHoverPin(undefined)}
            data-bench-canvas
            data-canvas-bg
          >
            {/* dots, visible only while navigating; grid lives in world
                space so both spacing AND dot size scale with zoom */}
            <div
              class={`canvas-dots pointer-events-none absolute inset-0 ${navigating() ? "navigating" : ""}`}
              style={{
                "background-image": `radial-gradient(circle, rgba(0,0,0,0.13) ${Math.max(0.75, zoom())}px, transparent ${Math.max(0.75, zoom())}px)`,
                "background-size": `${24 * zoom()}px ${24 * zoom()}px`,
                "background-position": `calc(50% + ${pan().x}px) calc(50% + ${pan().y}px)`,
              }}
            />

            {/* pannable world */}
            <div
              class="absolute left-1/2 top-1/2"
              style={{
                width: "0",
                height: "0",
                transform: `translate(${pan().x}px, ${pan().y}px) scale(${zoom()})`,
                transition: animating() ? "transform 240ms cubic-bezier(0.22, 1, 0.36, 1)" : "none",
              }}
            >
              <div
                class="absolute w-max -translate-x-1/2 -translate-y-1/2"
                ref={stageRef}
                data-bench-stage={s().slug}
                data-bench-state={currentUrl()}
              >
                <Dynamic component={resolveComponent(s().name)} {...componentProps()} />

                {/* live region marquee while dragging a highlight */}
                <Show when={regionDrag() ?? pending()?.rect}>
                  {(r) => (
                    <div
                      class="pointer-events-none absolute z-10 rounded-md border-2 border-amber-400/80 bg-amber-400/10"
                      style={{
                        left: `${r().x * 100}%`,
                        top: `${r().y * 100}%`,
                        width: `${r().w * 100}%`,
                        height: `${r().h * 100}%`,
                      }}
                    />
                  )}
                </Show>

                {/* ghost pin previews where a note would land */}
                <Show when={noteMode() && !pending() && hoverPin()}>
                  {(h) => (
                    <div
                      class="pointer-events-none absolute z-10 flex size-7 items-center justify-center rounded-full bg-amber-400/60 shadow-[0_2px_10px_rgba(217,119,6,0.3)] ring-2 ring-white/70"
                      style={{
                        left: `${h().x * 100}%`,
                        top: `${h().y * 100}%`,
                        transform: `translate(-50%, -50%) scale(${1 / zoom()})`,
                      }}
                    >
                      <Plus size={16} stroke-width={2} class="text-white" />
                    </div>
                  )}
                </Show>

                <For each={openNotes()}>
                  {(note, i) => (
                    <>
                      {/* saved region highlight; whispers until its pin opens.
                          Grabbing it drags the whole note; corners resize.
                          Regions render only in the state they were written
                          against. */}
                      <Show when={noteMatchesState(note) && pinRect(note)}>
                        {(r) => (
                          <div
                            class={`group/region absolute z-[5] rounded-md border-2 transition-colors duration-200 ${
                              noteMode()
                                ? "pointer-events-none"
                                : "cursor-grab active:cursor-grabbing"
                            } ${
                              openPin() === note.id
                                ? "border-amber-400/80 bg-amber-400/10"
                                : "border-amber-400/25 bg-amber-400/[0.04] hover:border-amber-400/50"
                            }`}
                            style={{
                              left: `${r().x * 100}%`,
                              top: `${r().y * 100}%`,
                              width: `${r().w * 100}%`,
                              height: `${r().h * 100}%`,
                            }}
                            onPointerDown={onNoteDrag(note)}
                          >
                            <For
                              each={[
                                { cx: 0 as const, cy: 0 as const, pos: "left-0 top-0", cursor: "cursor-nwse-resize" },
                                { cx: 1 as const, cy: 0 as const, pos: "right-0 top-0", cursor: "cursor-nesw-resize" },
                                { cx: 0 as const, cy: 1 as const, pos: "left-0 bottom-0", cursor: "cursor-nesw-resize" },
                                { cx: 1 as const, cy: 1 as const, pos: "right-0 bottom-0", cursor: "cursor-nwse-resize" },
                              ]}
                            >
                              {(corner) => (
                                <div
                                  class={`absolute size-4 ${corner.pos} ${corner.cursor} ${
                                    corner.cx === 0 ? "-translate-x-1/2" : "translate-x-1/2"
                                  } ${corner.cy === 0 ? "-translate-y-1/2" : "translate-y-1/2"} flex items-center justify-center opacity-0 transition-opacity duration-150 group-hover/region:opacity-100`}
                                  style={{ transform: `scale(${1 / zoom()})` }}
                                  onPointerDown={onRegionResize(note, corner.cx, corner.cy)}
                                >
                                  <div class="size-2.5 rounded-full border-2 border-amber-400 bg-white shadow-sm" />
                                </div>
                              )}
                            </For>
                          </div>
                        )}
                      </Show>
                      <div
                        class="absolute z-10"
                        style={{
                          left: `${pinCoords(note).x * 100}%`,
                          top: `${pinCoords(note).y * 100}%`,
                          transform: `translate(-50%, -50%) scale(${1 / zoom()})`,
                        }}
                        data-bench-note-id={note.id}
                      >
                      <button
                        type="button"
                        class={`flex size-7 items-center justify-center rounded-full font-mono text-base font-semibold text-white transition-all ${
                          note.author === "agent"
                            ? noteMatchesState(note)
                              ? "cursor-grab bg-indigo-500 shadow-[0_2px_10px_rgba(79,70,229,0.45)] hover:scale-110 active:cursor-grabbing"
                              : "cursor-pointer scale-75 bg-indigo-500/40 hover:scale-90 hover:bg-indigo-500/70"
                            : noteMatchesState(note)
                              ? "cursor-grab bg-amber-400 shadow-[0_2px_10px_rgba(217,119,6,0.45)] hover:scale-110 active:cursor-grabbing"
                              : "cursor-pointer scale-75 bg-amber-400/40 hover:scale-90 hover:bg-amber-400/70"
                        }`}
                        title={
                          noteMatchesState(note)
                            ? undefined
                            : "Note from another state · click to jump to it"
                        }
                        onPointerDown={onNoteDrag(note)}
                      >
                        {i() + 1}
                      </button>
                      <Show when={openPin() === note.id}>
                        <div
                          class="glass absolute bottom-9 left-0 z-20 w-80 rounded-2xl p-4"
                          onClick={(e) => e.stopPropagation()}
                          onPointerDown={(e) => e.stopPropagation()}
                        >
                          <div class="flex items-baseline justify-between gap-3">
                            <span class="flex items-baseline gap-2">
                              <span
                                class={`font-mono text-base ${
                                  note.author === "agent" ? "text-indigo-500" : "text-zinc-400"
                                }`}
                              >
                                {note.author}
                              </span>
                              <span class="font-mono text-base text-zinc-300">
                                {timeAgo(note.created)}
                              </span>
                            </span>
                            <button
                              type="button"
                              class="cursor-pointer text-base font-medium text-zinc-400 transition-colors hover:text-zinc-900"
                              onClick={() => handleResolve(note.id)}
                            >
                              resolve
                            </button>
                          </div>
                          <p class="mt-1 text-base leading-relaxed text-zinc-800">{note.text}</p>

                          <Show when={(note.replies ?? []).length > 0}>
                            <div class="mt-3 flex flex-col gap-2.5 border-t border-black/[0.05] pt-3">
                              <For each={note.replies}>
                                {(reply) => (
                                  <div>
                                    <span class="flex items-baseline gap-2">
                                      <span
                                        class={`font-mono text-base ${
                                          reply.author === "agent"
                                            ? "text-indigo-500"
                                            : "text-zinc-400"
                                        }`}
                                      >
                                        {reply.author}
                                      </span>
                                      <span class="font-mono text-base text-zinc-300">
                                        {timeAgo(reply.created)}
                                      </span>
                                    </span>
                                    <p class="mt-0.5 text-base leading-relaxed text-zinc-800">
                                      {reply.text}
                                    </p>
                                  </div>
                                )}
                              </For>
                            </div>
                          </Show>

                          <input
                            type="text"
                            class="mt-3 h-10 w-full rounded-lg bg-black/[0.04] px-3 text-base text-zinc-800 outline-none transition-colors placeholder:text-zinc-300 focus:bg-black/[0.06]"
                            placeholder="Reply…"
                            value={replyText()}
                            onInput={(e) => setReplyText(e.currentTarget.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") submitReply(note)
                              e.stopPropagation()
                            }}
                            data-bench-reply-input
                          />
                        </div>
                      </Show>
                      </div>
                    </>
                  )}
                </For>

                <Show when={pending()}>
                  {(p) => (
                    <div
                      class="glass absolute z-20 w-80 rounded-2xl p-4"
                      style={{
                        left: `${p().coords.x * 100}%`,
                        top: `${p().coords.y * 100}%`,
                        transform: `translate(-8px, calc(-100% - 14px)) scale(${1 / zoom()})`,
                        "transform-origin": "bottom left",
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <textarea
                        class="h-20 w-full resize-none bg-transparent text-base leading-relaxed text-zinc-800 outline-none placeholder:text-zinc-300"
                        placeholder="What feels off?"
                        value={noteText()}
                        onInput={(e) => setNoteText(e.currentTarget.value)}
                        data-bench-note-input
                      />
                      <div class="mt-2 flex items-center justify-between">
                        <span class="max-w-32 truncate font-mono text-base text-zinc-300">
                          {p().selector}
                        </span>
                        <div class="flex gap-4">
                          <button
                            type="button"
                            class="cursor-pointer text-base text-zinc-400 transition-colors hover:text-zinc-900"
                            onClick={() => setPending(undefined)}
                          >
                            cancel
                          </button>
                          <button
                            type="button"
                            class="cursor-pointer text-base font-semibold text-zinc-900 transition-colors hover:text-zinc-500"
                            onClick={submitNote}
                            data-bench-note-save
                          >
                            pin
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </Show>
              </div>
            </div>

            {/* breadcrumb, top left */}
            <div class="glass rise-in absolute left-5 top-5 flex h-12 items-center gap-3 rounded-full px-5">
              <A
                href="/__bench"
                class="flex cursor-pointer items-center gap-2.5 font-mono text-base text-zinc-400 transition-colors hover:text-zinc-900"
                data-bench-back
              >
                <ArrowLeft size={18} stroke-width={1.75} />
                bench
              </A>
              <span class="text-zinc-300">/</span>
              <span class="font-mono text-base font-semibold text-zinc-900">{s().name}</span>
            </div>

            {/* zoom rail, left center */}
            <div
              class="glass rise-in absolute left-5 top-1/2 flex w-12 -translate-y-1/2 flex-col items-center rounded-full py-2"
              style={{ "animation-delay": "180ms" }}
              data-bench-zoom-rail
            >
              <button
                type="button"
                class="flex size-8 cursor-pointer items-center justify-center rounded-full text-zinc-400 transition-colors hover:text-zinc-900"
                onClick={() => zoomCenter(zoom() * 1.4, true)}
              >
                <Plus size={18} stroke-width={1.75} />
              </button>
              <div
                class="relative h-52 w-full cursor-ns-resize touch-none"
                ref={setTapeRef}
                onPointerDown={onTapePointerDown}
                data-bench-zoom-track
              >
                <For each={TICKS}>
                  {(v) => (
                    <div
                      class="pointer-events-none absolute left-1/2 h-px -translate-x-1/2 rounded-full bg-zinc-500"
                      style={tickStyle(v)}
                    />
                  )}
                </For>
                <div class="pointer-events-none absolute left-1/2 top-1/2 h-[2px] w-8 -translate-x-1/2 -translate-y-1/2 rounded-full bg-zinc-900" />
              </div>
              <button
                type="button"
                class="flex size-8 cursor-pointer items-center justify-center rounded-full text-zinc-400 transition-colors hover:text-zinc-900"
                onClick={() => zoomCenter(zoom() / 1.4, true)}
              >
                <Minus size={18} stroke-width={1.75} />
              </button>
              {/* fixed width so the number/icon swap can't shift the hover
                  target out from under the cursor */}
              <button
                type="button"
                class="group flex h-8 w-10 cursor-pointer items-center justify-center pb-0.5 font-mono text-base text-zinc-500 transition-colors hover:text-zinc-900"
                onClick={resetView}
                title="reset view"
              >
                <span class="group-hover:hidden">{Math.round(zoom() * 100)}</span>
                <RotateCcw size={16} stroke-width={1.75} class="hidden group-hover:block" />
              </button>
            </div>

            {/* note toggle, bottom center */}
            <div class="rise-in group absolute bottom-5 left-1/2 -translate-x-1/2" style={{ "animation-delay": "240ms" }}>
              <div class="glass pointer-events-none absolute bottom-full left-1/2 mb-2.5 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                <span class="text-base font-medium text-zinc-700">
                  {noteMode() ? "Cancel" : "Add note"}
                </span>
                <kbd class="rounded-md bg-black/[0.05] px-1.5 py-0.5 font-mono text-base text-zinc-400">
                  {noteMode() ? "esc" : "C"}
                </kbd>
              </div>
              <button
                type="button"
                class={`flex h-13 cursor-pointer items-center gap-2.5 rounded-full px-6 text-base font-medium transition-all ${
                  noteMode()
                    ? "bg-amber-400 text-white shadow-[0_4px_20px_rgba(217,119,6,0.4)]"
                    : "glass text-zinc-600 hover:text-zinc-900"
                }`}
                onClick={() => {
                  setNoteMode(!noteMode())
                  setPending(undefined)
                }}
                data-bench-note-toggle
              >
                <MessageSquarePlus size={20} stroke-width={1.75} />
                {noteMode() ? "Cancel" : "Add note"}
              </button>
            </div>

            {/* knobs panel, right */}
            <aside
              class="glass smooth-corners rise-in absolute right-5 top-[84px] flex max-h-[calc(100vh-10rem)] w-80 flex-col overflow-hidden"
              style={{ "animation-delay": "120ms" }}
              ref={(el) => {
                // The canvas wheel handler pans; stop panel scrolls from
                // bubbling into it so the panel scrolls natively.
                el.addEventListener("wheel", (e) => e.stopPropagation(), { passive: true })
              }}
            >
              <div class="min-h-0 flex-1 overflow-y-auto px-5 py-5">
              <Show when={Object.keys(fixture()?.states ?? {}).length > 1}>
                <div class="mb-2 border-b border-black/[0.05] pb-4 pt-1">
                  <div class="flex flex-wrap gap-1.5">
                    <For each={Object.keys(fixture()?.states ?? {})}>
                      {(name) => (
                        <button
                          type="button"
                          class={`cursor-pointer rounded-full px-3 py-1 font-mono text-base transition-colors ${
                            activeFixtureState() === name
                              ? "bg-zinc-900 text-white"
                              : "text-zinc-400 hover:text-zinc-900"
                          }`}
                          onClick={() => {
                            const cleared: Record<string, string | undefined> = {}
                            for (const key of Object.keys(searchParams)) cleared[key] = undefined
                            setSearchParams({
                              ...cleared,
                              ...fixtureState("default"),
                              ...fixtureState(name),
                            })
                          }}
                          data-bench-fixture={name}
                        >
                          {name}
                        </button>
                      )}
                    </For>
                  </div>
                </div>
              </Show>

              <For each={s().props.filter((p) => p.kind !== "boolean")}>
                {(prop) => (
                  <Knob
                    prop={prop}
                    value={knobValues()[prop.name]}
                    onChange={(value) => setSearchParams({ [prop.name]: value })}
                  />
                )}
              </For>

              {/* boolean toggles sit two-up in a grid */}
              <div class="grid grid-cols-2 gap-x-5">
                <For each={s().props.filter((p) => p.kind === "boolean")}>
                  {(prop) => (
                    <Knob
                      prop={prop}
                      value={knobValues()[prop.name]}
                      onChange={(value) => setSearchParams({ [prop.name]: value })}
                    />
                  )}
                </For>
              </div>

              <Show when={s().usages.length > 0}>
                <div class="mt-2 border-t border-black/[0.05] pt-3">
                  <For each={s().usages}>
                    {(usage) => (
                      <a
                        href={`vscode://file/${manifest()?.root ?? ""}/${usage.file}:${usage.line}`}
                        class="block cursor-pointer py-1.5 font-mono text-base text-zinc-400 transition-colors hover:text-zinc-900"
                        title={usage.snippet}
                      >
                        {usage.file.replace("src/", "")}:{usage.line}
                        <Show when={usage.internal}>
                          <span class="ml-2 rounded-md bg-black/[0.04] px-1.5 py-0.5 text-[13px] text-zinc-400">
                            internal
                          </span>
                        </Show>
                      </a>
                    )}
                  </For>
                </div>
              </Show>

              </div>

              {/* copy a shareable link to the exact state on screen —
                  pinned below the scrolling content */}
              <div class="shrink-0 border-t border-black/[0.05] p-3">
                <button
                  type="button"
                  class="flex w-full cursor-pointer items-center justify-center gap-2.5 rounded-2xl bg-black/[0.04] py-3 text-base font-medium text-zinc-600 transition-colors hover:bg-black/[0.06] hover:text-zinc-900"
                  onClick={copyUrl}
                  title="Copies a URL that reopens this component with exactly these knob values"
                  data-bench-copy-state
                >
                  <Show
                    when={copied()}
                    fallback={
                      <>
                        <Link2 size={18} stroke-width={1.75} />
                        copy link to this state
                      </>
                    }
                  >
                    <Check size={18} stroke-width={1.75} />
                    copied
                  </Show>
                </button>
              </div>
            </aside>
          </div>
        )}
      </Show>
    </Suspense>
  )
}
