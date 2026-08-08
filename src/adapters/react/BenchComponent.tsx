import {
  createElement,
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { Link, useNavigate, useParams, useSearchParams } from "react-router"
import {
  ArrowLeft,
  Check,
  Link2,
  MessageSquarePlus,
  Minus,
  Plus,
  RotateCcw,
} from "lucide-react"
import {
  benchAuthor,
  coerceProps,
  fetchFixture,
  fetchManifest,
  fetchNotes,
  moveNote,
  parseStateUrl,
  postNote,
  replyNote,
  resolveComponent,
  resolveNote,
  sameState,
  selectorWithin,
  stateUrl,
  stringifyFixtureValues,
  type BenchComponentSpec,
  type BenchFixture,
  type BenchManifest,
  type BenchNote,
  type BenchProp,
} from "./data"

// React port of the Solid canvas surface; keep the two in lockstep. The
// Solid file reads signals live inside long-lived pointer handlers; here
// the same values ride mirror refs (panRef/zoomRef/...) so window-level
// move/up listeners never see stale state.

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

function Knob({
  prop,
  value,
  onChange,
}: {
  prop: BenchProp
  value: string | undefined
  onChange: (value: string) => void
}) {
  if (prop.kind === "unsupported") return null

  let control: ReactNode = null
  switch (prop.kind) {
    case "enum":
      control = (
        <div
          className="grid rounded-xl bg-black/[0.04] p-1"
          style={{
            gridTemplateColumns: `repeat(${
              (prop.options?.length ?? 1) > 3 ? 2 : prop.options?.length ?? 1
            }, 1fr)`,
          }}
        >
          {prop.options?.map((option) => (
            <button
              key={option}
              type="button"
              className={`cursor-pointer truncate rounded-lg px-2 py-1.5 font-mono text-base transition-colors ${
                value === option
                  ? "bg-white text-zinc-900 shadow-[0_1px_4px_rgba(0,0,0,0.12)]"
                  : "text-zinc-400 hover:text-zinc-700"
              }`}
              onClick={() => onChange(option)}
            >
              {option}
            </button>
          ))}
        </div>
      )
      break
    case "boolean":
      control = (
        <button
          type="button"
          role="switch"
          aria-checked={value === "true"}
          className={`relative h-[26px] w-11 cursor-pointer rounded-full transition-colors duration-200 ${
            value === "true" ? "bg-zinc-900" : "bg-black/[0.12]"
          }`}
          onClick={() => onChange(value === "true" ? "false" : "true")}
        >
          <span
            className={`absolute top-[3px] size-5 rounded-full bg-white shadow-sm transition-[left] duration-200 ${
              value === "true" ? "left-[21px]" : "left-[3px]"
            }`}
          />
        </button>
      )
      break
    case "string":
    case "children":
      control = (
        <input
          type="text"
          className="h-10 w-full rounded-lg bg-black/[0.04] px-3 font-mono text-base text-zinc-800 outline-none transition-colors placeholder:text-zinc-300 focus:bg-black/[0.06]"
          value={value ?? ""}
          onChange={(e) => onChange(e.currentTarget.value)}
        />
      )
      break
    case "number":
      control = (
        <input
          type="number"
          className="h-10 w-24 rounded-lg bg-black/[0.04] px-3 font-mono text-base text-zinc-800 outline-none focus:bg-black/[0.06]"
          value={value ?? ""}
          onChange={(e) => onChange(e.currentTarget.value)}
        />
      )
      break
  }

  return (
    <div
      className="flex flex-col gap-2 py-3"
      title={prop.description ? `${prop.description} · ${prop.raw}` : prop.raw}
    >
      <span className="text-base font-medium text-zinc-500">{prop.name}</span>
      {control}
    </div>
  )
}

// --- page ------------------------------------------------------------------

export function BenchComponent() {
  const params = useParams<{ slug: string }>()
  const slug = params.slug ?? ""
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()

  const [manifest, setManifest] = useState<BenchManifest>()
  const [fixture, setFixture] = useState<BenchFixture>()
  const [notes, setNotes] = useState<BenchNote[]>([])

  useEffect(() => {
    let ignore = false
    fetchManifest().then((m) => !ignore && setManifest(m))
    return () => {
      ignore = true
    }
  }, [])
  useEffect(() => {
    let ignore = false
    fetchFixture(slug).then((f) => !ignore && setFixture(f))
    fetchNotes(slug).then((n) => !ignore && setNotes(n))
    return () => {
      ignore = true
    }
  }, [slug])

  const spec: BenchComponentSpec | undefined = manifest?.components.find((c) => c.slug === slug)

  const fixtureState = (name: string): Record<string, string> =>
    stringifyFixtureValues(fixture?.states?.[name] ?? {})

  const knobValues = useMemo<Record<string, string>>(() => {
    const base: Record<string, string> = { ...fixtureState("default") }
    for (const [key, value] of searchParams) base[key] = value
    return base
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fixture, searchParams])

  const componentProps = useMemo(
    () => (spec ? coerceProps(spec, knobValues) : {}),
    [spec, knobValues]
  )

  const currentUrl = stateUrl(slug, knobValues)

  const activeFixtureState = useMemo(() => {
    const current = JSON.stringify(knobValues)
    for (const name of Object.keys(fixture?.states ?? {})) {
      if (JSON.stringify({ ...fixtureState("default"), ...fixtureState(name) }) === current) {
        return name
      }
    }
    return undefined
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fixture, knobValues])

  const setKnob = (name: string, value: string) =>
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set(name, value)
      return next
    })

  // --- canvas state --------------------------------------------------------

  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [navigating, setNavigating] = useState(false)
  const [animating, setAnimating] = useState(false)
  const [canvasEl, setCanvasEl] = useState<HTMLDivElement | null>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const navTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const panRef = useRef(pan)
  panRef.current = pan
  const zoomRef = useRef(zoom)
  zoomRef.current = zoom

  const touchNav = () => {
    setNavigating(true)
    clearTimeout(navTimer.current)
    navTimer.current = setTimeout(() => setNavigating(false), 350)
  }

  const clampZoom = (z: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z))

  const zoomAt = (clientX: number, clientY: number, nextZoom: number) => {
    if (!canvasEl) return
    const rect = canvasEl.getBoundingClientRect()
    const cx = clientX - rect.left - rect.width / 2
    const cy = clientY - rect.top - rect.height / 2
    const z = zoomRef.current
    const nz = clampZoom(nextZoom)
    // Keep the point under the cursor stationary while scaling.
    const p = panRef.current
    setPan({
      x: cx - ((cx - p.x) * nz) / z,
      y: cy - ((cy - p.y) * nz) / z,
    })
    setZoom(nz)
    touchNav()
  }

  /** Zoom anchored to the canvas center (buttons, slider). */
  const zoomCenter = (nextZoom: number, animate = false) => {
    if (!canvasEl) return
    const rect = canvasEl.getBoundingClientRect()
    if (animate) {
      setAnimating(true)
      setTimeout(() => setAnimating(false), 220)
    }
    zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, nextZoom)
  }
  const zoomCenterRef = useRef(zoomCenter)
  zoomCenterRef.current = zoomCenter

  const resetView = () => {
    setAnimating(true)
    setPan({ x: 0, y: 0 })
    setZoom(1)
    setTimeout(() => setAnimating(false), 260)
  }

  // Wheel must be non-passive to preventDefault, so it attaches natively.
  useEffect(() => {
    if (!canvasEl) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      if (e.ctrlKey || e.metaKey) {
        zoomAt(e.clientX, e.clientY, zoomRef.current * Math.exp(-e.deltaY * 0.01))
      } else {
        setPan((p) => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }))
        touchNav()
      }
    }
    canvasEl.addEventListener("wheel", onWheel, { passive: false })
    return () => canvasEl.removeEventListener("wheel", onWheel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasEl])

  /** Client point → stage-relative fractions (may exceed 0..1 off-component). */
  const stageRel = (clientX: number, clientY: number) => {
    const rect = stageRef.current!.getBoundingClientRect()
    return {
      x: (clientX - rect.left) / rect.width,
      y: (clientY - rect.top) / rect.height,
    }
  }

  /** Notes can land on the component or the empty canvas, never on chrome. */
  const isNotable = (t: HTMLElement) =>
    t.hasAttribute("data-canvas-bg") || (stageRef.current?.contains(t) ?? false)

  // --- notes state ---------------------------------------------------------

  const [noteMode, setNoteMode] = useState(false)
  const [pending, setPending] = useState<
    | {
        coords: { x: number; y: number }
        selector: string
        rect?: { x: number; y: number; w: number; h: number }
      }
    | undefined
  >()
  const [noteText, setNoteText] = useState("")
  const [hoverPin, setHoverPin] = useState<{ x: number; y: number } | undefined>()
  const [regionDrag, setRegionDrag] = useState<
    { x: number; y: number; w: number; h: number } | undefined
  >()
  const [openPin, setOpenPin] = useState<string | undefined>()
  const [replyText, setReplyText] = useState("")
  const [copied, setCopied] = useState(false)

  const [pinOverride, setPinOverride] = useState<
    Record<
      string,
      {
        coords: { x: number; y: number }
        rect?: { x: number; y: number; w: number; h: number }
      }
    >
  >({})
  const pinOverrideRef = useRef(pinOverride)
  pinOverrideRef.current = pinOverride

  const pinCoords = (note: BenchNote) => pinOverride[note.id]?.coords ?? note.coords
  const pinRect = (note: BenchNote) => {
    const override = pinOverride[note.id]
    return override ? override.rect : note.rect
  }

  /** Does a note belong to the knob state currently on screen? */
  const noteMatchesState = (note: BenchNote) =>
    sameState(knobValues, parseStateUrl(note.stateUrl).values)

  const openNotes = notes.filter((n) => n.status === "open")

  const onPointerDown = (e: React.PointerEvent) => {
    const target = e.target as HTMLElement

    // Note mode: click drops a pin, drag highlights a region. Anywhere on
    // the canvas counts; floating chrome does not.
    if (noteMode) {
      if (!stageRef.current || pending || !isNotable(target)) return
      e.preventDefault()
      const startClientX = e.clientX
      const startClientY = e.clientY
      const start = stageRel(e.clientX, e.clientY)
      let dragged = false
      let region: { x: number; y: number; w: number; h: number } | undefined
      const move = (ev: PointerEvent) => {
        if (Math.abs(ev.clientX - startClientX) + Math.abs(ev.clientY - startClientY) > 6) {
          dragged = true
        }
        const cur = stageRel(ev.clientX, ev.clientY)
        if (!dragged) {
          setHoverPin(cur)
          return
        }
        region = {
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
          stageRef.current && stageRef.current.contains(upTarget)
            ? selectorWithin(stageRef.current, upTarget)
            : "(canvas)"
        const rect = dragged ? region : undefined
        setPending({
          // Region notes anchor their pin to the region's top-right corner.
          coords: rect ? { x: rect.x + rect.w, y: rect.y } : cur,
          selector,
          rect,
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
    const startX = e.clientX
    const startY = e.clientY
    const origin = panRef.current
    const move = (ev: PointerEvent) => {
      setPan({ x: origin.x + (ev.clientX - startX), y: origin.y + (ev.clientY - startY) })
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
  const TICKS = useMemo(() => {
    const ticks: number[] = []
    for (let v = LN_MIN; v <= LN_MAX + 1e-9; v += TICK_STEP) ticks.push(v)
    return ticks
  }, [])

  /** Vertical position of a tick for the current zoom; center = current. */
  const tickY = (v: number) => TAPE_H / 2 - (v - Math.log(zoom)) * PX_PER_LN

  const tickStyle = (v: number): React.CSSProperties => {
    const y = tickY(v)
    const dist = Math.abs(y - TAPE_H / 2)
    const falloff = Math.max(0, 1 - dist / (TAPE_H / 2))
    const major = Math.abs(v / 0.5 - Math.round(v / 0.5)) < 1e-6
    return {
      top: `${y}px`,
      // Fade toward the ends but never fully vanish inside the tape, so the
      // tick field runs edge to edge.
      opacity: 0.16 + Math.pow(falloff, 1.6) * 0.84,
      width: `${(major ? 18 : 10) + falloff * 10}px`,
      display: y < -2 || y > TAPE_H + 2 ? "none" : "block",
    }
  }

  const onTapePointerDown = (e: React.PointerEvent) => {
    e.preventDefault()
    const startY = e.clientY
    const startLn = Math.log(zoomRef.current)
    const move = (ev: PointerEvent) => {
      // Drag up pulls the tape toward higher magnification.
      zoomCenterRef.current(Math.exp(startLn + (startY - ev.clientY) / PX_PER_LN))
    }
    const up = () => {
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", up)
    }
    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", up)
  }

  /** Scrolling on the tape zooms too; stop it reaching the canvas pan. */
  const [tapeEl, setTapeEl] = useState<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!tapeEl) return
    const onTapeWheel = (e: WheelEvent) => {
      e.preventDefault()
      e.stopPropagation()
      zoomCenterRef.current(zoomRef.current * Math.exp(-e.deltaY * 0.005))
    }
    tapeEl.addEventListener("wheel", onTapeWheel, { passive: false })
    return () => tapeEl.removeEventListener("wheel", onTapeWheel)
  }, [tapeEl])

  // --- draggable pins ------------------------------------------------------

  /** Resize a note's region by dragging a corner; the opposite corner anchors. */
  const onRegionResize =
    (note: BenchNote, cornerX: 0 | 1, cornerY: 0 | 1) => (e: React.PointerEvent) => {
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
        const override = pinOverrideRef.current[note.id]
        if (override?.rect) {
          const saved = await moveNote(slug, note.id, override.coords, override.rect)
          setNotes((prev) => prev.map((n) => (n.id === note.id ? saved : n)))
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
  const onNoteDrag = (note: BenchNote) => (e: React.PointerEvent) => {
    // While composing a note, existing pins are inert: the click falls
    // through to the canvas and places the new note instead.
    if (noteMode) return
    e.stopPropagation()
    e.preventDefault()
    const startX = e.clientX
    const startY = e.clientY
    const origCoords = note.coords
    const origRect = note.rect
    let moved = false
    const move = (ev: PointerEvent) => {
      if (Math.abs(ev.clientX - startX) + Math.abs(ev.clientY - startY) > 4) moved = true
      if (!moved || !stageRef.current) return
      const rect = stageRef.current.getBoundingClientRect()
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
        const override = pinOverrideRef.current[note.id]
        if (override) {
          const saved = await moveNote(slug, note.id, override.coords, override.rect)
          setNotes((prev) => prev.map((n) => (n.id === note.id ? saved : n)))
          setPinOverride((prev) => {
            const next = { ...prev }
            delete next[note.id]
            return next
          })
        }
      } else if (noteMatchesState(note)) {
        setOpenPin((prev) => (prev === note.id ? undefined : note.id))
      } else {
        // A pin from another state: jump to the state it was written against.
        navigate(note.stateUrl)
        setOpenPin(note.id)
      }
    }
    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", up)
  }

  // --- note actions --------------------------------------------------------

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (!noteMode || pending || !stageRef.current) return
    if (!isNotable(e.target as HTMLElement)) {
      setHoverPin(undefined)
      return
    }
    setHoverPin(stageRel(e.clientX, e.clientY))
  }

  const submitNote = async () => {
    if (!pending || !noteText.trim()) return
    const saved = await postNote(slug, {
      stateUrl: currentUrl,
      selector: pending.selector,
      coords: pending.coords,
      rect: pending.rect,
      text: noteText.trim(),
      author: benchAuthor,
    })
    setNotes((prev) => [...prev, saved])
    setPending(undefined)
    setNoteText("")
    setNoteMode(false)
  }

  const handleResolve = async (id: string) => {
    setOpenPin(undefined)
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, status: "resolved" as const } : n)))
    await resolveNote(slug, id)
  }

  const submitReply = async (note: BenchNote) => {
    const text = replyText.trim()
    if (!text) return
    setReplyText("")
    const saved = await replyNote(slug, note.id, text, benchAuthor)
    setNotes((prev) => prev.map((n) => (n.id === note.id ? saved : n)))
  }

  const copyUrl = () => {
    navigator.clipboard.writeText(location.origin + currentUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 1200)
  }

  // Hotkey: "c" toggles note mode (unless typing in a field).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable) return
      if (e.key === "c" && !e.metaKey && !e.ctrlKey) {
        setNoteMode((prev) => !prev)
        setPending(undefined)
      }
      if (e.key === "Escape") {
        setNoteMode(false)
        setPending(undefined)
        setOpenPin(undefined)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  if (!manifest) return null
  if (!spec) {
    return <p className="p-10 font-mono text-base text-zinc-400">no component "{slug}"</p>
  }
  const stageComponent = resolveComponent(spec.name, spec.target)
  const liveRegion = regionDrag ?? pending?.rect

  return (
    <div
      className={`relative h-screen overflow-hidden ${noteMode && hoverPin ? "cursor-none" : ""}`}
      ref={setCanvasEl}
      onPointerDown={onPointerDown}
      onMouseMove={handleCanvasMouseMove}
      onMouseLeave={() => setHoverPin(undefined)}
      data-bench-canvas=""
      data-canvas-bg=""
    >
      {/* dots, visible only while navigating; grid lives in world space so
          both spacing AND dot size scale with zoom */}
      <div
        className={`canvas-dots pointer-events-none absolute inset-0 ${navigating ? "navigating" : ""}`}
        style={{
          backgroundImage: `radial-gradient(circle, rgba(0,0,0,0.13) ${Math.max(0.75, zoom)}px, transparent ${Math.max(0.75, zoom)}px)`,
          backgroundSize: `${24 * zoom}px ${24 * zoom}px`,
          backgroundPosition: `calc(50% + ${pan.x}px) calc(50% + ${pan.y}px)`,
        }}
      />

      {/* pannable world */}
      <div
        className="absolute left-1/2 top-1/2"
        style={{
          width: 0,
          height: 0,
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transition: animating ? "transform 240ms cubic-bezier(0.22, 1, 0.36, 1)" : "none",
        }}
      >
        <div
          className="absolute w-max -translate-x-1/2 -translate-y-1/2"
          ref={stageRef}
          data-bench-stage={spec.slug}
          data-bench-state={currentUrl}
        >
          {stageComponent && createElement(stageComponent, componentProps)}

          {/* live region marquee while dragging a highlight */}
          {liveRegion && (
            <div
              className="pointer-events-none absolute z-10 rounded-md border-2 border-amber-400/80 bg-amber-400/10"
              style={{
                left: `${liveRegion.x * 100}%`,
                top: `${liveRegion.y * 100}%`,
                width: `${liveRegion.w * 100}%`,
                height: `${liveRegion.h * 100}%`,
              }}
            />
          )}

          {/* ghost pin previews where a note would land */}
          {noteMode && !pending && hoverPin && (
            <div
              className="pointer-events-none absolute z-10 flex size-7 items-center justify-center rounded-full bg-amber-400/60 shadow-[0_2px_10px_rgba(217,119,6,0.3)] ring-2 ring-white/70"
              style={{
                left: `${hoverPin.x * 100}%`,
                top: `${hoverPin.y * 100}%`,
                transform: `translate(-50%, -50%) scale(${1 / zoom})`,
              }}
            >
              <Plus size={16} strokeWidth={2} className="text-white" />
            </div>
          )}

          {openNotes.map((note, i) => (
            <Fragment key={note.id}>
              {/* saved region highlight; whispers until its pin opens.
                  Grabbing it drags the whole note; corners resize. Regions
                  render only in the state they were written against. */}
              {noteMatchesState(note) && pinRect(note) && (
                <div
                  className={`group/region absolute z-[5] rounded-md border-2 transition-colors duration-200 ${
                    noteMode ? "pointer-events-none" : "cursor-grab active:cursor-grabbing"
                  } ${
                    openPin === note.id
                      ? "border-amber-400/80 bg-amber-400/10"
                      : "border-amber-400/25 bg-amber-400/[0.04] hover:border-amber-400/50"
                  }`}
                  style={{
                    left: `${pinRect(note)!.x * 100}%`,
                    top: `${pinRect(note)!.y * 100}%`,
                    width: `${pinRect(note)!.w * 100}%`,
                    height: `${pinRect(note)!.h * 100}%`,
                  }}
                  onPointerDown={onNoteDrag(note)}
                >
                  {(
                    [
                      { cx: 0, cy: 0, pos: "left-0 top-0", cursor: "cursor-nwse-resize" },
                      { cx: 1, cy: 0, pos: "right-0 top-0", cursor: "cursor-nesw-resize" },
                      { cx: 0, cy: 1, pos: "left-0 bottom-0", cursor: "cursor-nesw-resize" },
                      { cx: 1, cy: 1, pos: "right-0 bottom-0", cursor: "cursor-nwse-resize" },
                    ] as const
                  ).map((corner) => (
                    <div
                      key={corner.pos}
                      className={`absolute size-4 ${corner.pos} ${corner.cursor} ${
                        corner.cx === 0 ? "-translate-x-1/2" : "translate-x-1/2"
                      } ${
                        corner.cy === 0 ? "-translate-y-1/2" : "translate-y-1/2"
                      } flex items-center justify-center opacity-0 transition-opacity duration-150 group-hover/region:opacity-100`}
                      style={{ transform: `scale(${1 / zoom})` }}
                      onPointerDown={onRegionResize(note, corner.cx, corner.cy)}
                    >
                      <div className="size-2.5 rounded-full border-2 border-amber-400 bg-white shadow-sm" />
                    </div>
                  ))}
                </div>
              )}
              <div
                className="absolute z-10"
                style={{
                  left: `${pinCoords(note).x * 100}%`,
                  top: `${pinCoords(note).y * 100}%`,
                  transform: `translate(-50%, -50%) scale(${1 / zoom})`,
                }}
                data-bench-note-id={note.id}
              >
                <button
                  type="button"
                  className={`flex size-7 items-center justify-center rounded-full font-mono text-base font-semibold text-white transition-all ${
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
                  {i + 1}
                </button>
                {openPin === note.id && (
                  <div
                    className="glass absolute bottom-9 left-0 z-20 w-80 rounded-2xl p-4"
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="flex items-baseline gap-2">
                        <span
                          className={`font-mono text-base ${
                            note.author === "agent" ? "text-indigo-500" : "text-zinc-400"
                          }`}
                        >
                          {note.author}
                        </span>
                        <span className="font-mono text-base text-zinc-300">
                          {timeAgo(note.created)}
                        </span>
                      </span>
                      <button
                        type="button"
                        className="cursor-pointer text-base font-medium text-zinc-400 transition-colors hover:text-zinc-900"
                        onClick={() => handleResolve(note.id)}
                      >
                        resolve
                      </button>
                    </div>
                    <p className="mt-1 text-base leading-relaxed text-zinc-800">{note.text}</p>

                    {(note.replies ?? []).length > 0 && (
                      <div className="mt-3 flex flex-col gap-2.5 border-t border-black/[0.05] pt-3">
                        {note.replies!.map((reply) => (
                          <div key={reply.id}>
                            <span className="flex items-baseline gap-2">
                              <span
                                className={`font-mono text-base ${
                                  reply.author === "agent" ? "text-indigo-500" : "text-zinc-400"
                                }`}
                              >
                                {reply.author}
                              </span>
                              <span className="font-mono text-base text-zinc-300">
                                {timeAgo(reply.created)}
                              </span>
                            </span>
                            <p className="mt-0.5 text-base leading-relaxed text-zinc-800">
                              {reply.text}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}

                    <input
                      type="text"
                      className="mt-3 h-10 w-full rounded-lg bg-black/[0.04] px-3 text-base text-zinc-800 outline-none transition-colors placeholder:text-zinc-300 focus:bg-black/[0.06]"
                      placeholder="Reply…"
                      value={replyText}
                      onChange={(e) => setReplyText(e.currentTarget.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") submitReply(note)
                        e.stopPropagation()
                      }}
                      data-bench-reply-input=""
                    />
                  </div>
                )}
              </div>
            </Fragment>
          ))}

          {pending && (
            <div
              className="glass absolute z-20 w-80 rounded-2xl p-4"
              style={{
                left: `${pending.coords.x * 100}%`,
                top: `${pending.coords.y * 100}%`,
                transform: `translate(-8px, calc(-100% - 14px)) scale(${1 / zoom})`,
                transformOrigin: "bottom left",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <textarea
                className="h-20 w-full resize-none bg-transparent text-base leading-relaxed text-zinc-800 outline-none placeholder:text-zinc-300"
                placeholder="What feels off?"
                value={noteText}
                onChange={(e) => setNoteText(e.currentTarget.value)}
                data-bench-note-input=""
              />
              <div className="mt-2 flex items-center justify-between">
                <span className="max-w-32 truncate font-mono text-base text-zinc-300">
                  {pending.selector}
                </span>
                <div className="flex gap-4">
                  <button
                    type="button"
                    className="cursor-pointer text-base text-zinc-400 transition-colors hover:text-zinc-900"
                    onClick={() => setPending(undefined)}
                  >
                    cancel
                  </button>
                  <button
                    type="button"
                    className="cursor-pointer text-base font-semibold text-zinc-900 transition-colors hover:text-zinc-500"
                    onClick={submitNote}
                    data-bench-note-save=""
                  >
                    pin
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* breadcrumb, top left */}
      <div className="glass rise-in absolute left-5 top-5 flex h-12 items-center gap-3 rounded-full px-5">
        <Link
          to="/__bench"
          className="flex cursor-pointer items-center gap-2.5 font-mono text-base text-zinc-400 transition-colors hover:text-zinc-900"
          data-bench-back=""
        >
          <ArrowLeft size={18} strokeWidth={1.75} />
          bench
        </Link>
        <span className="text-zinc-300">/</span>
        <span className="font-mono text-base font-semibold text-zinc-900">{spec.name}</span>
      </div>

      {/* zoom rail, left center */}
      <div
        className="glass rise-in absolute left-5 top-1/2 flex w-12 -translate-y-1/2 flex-col items-center rounded-full py-2"
        style={{ animationDelay: "180ms" }}
        data-bench-zoom-rail=""
      >
        <button
          type="button"
          className="flex size-8 cursor-pointer items-center justify-center rounded-full text-zinc-400 transition-colors hover:text-zinc-900"
          onClick={() => zoomCenter(zoom * 1.4, true)}
        >
          <Plus size={18} strokeWidth={1.75} />
        </button>
        <div
          className="relative h-52 w-full cursor-ns-resize touch-none"
          ref={setTapeEl}
          onPointerDown={onTapePointerDown}
          data-bench-zoom-track=""
        >
          {TICKS.map((v) => (
            <div
              key={v}
              className="pointer-events-none absolute left-1/2 h-px -translate-x-1/2 rounded-full bg-zinc-500"
              style={tickStyle(v)}
            />
          ))}
          <div className="pointer-events-none absolute left-1/2 top-1/2 h-[2px] w-8 -translate-x-1/2 -translate-y-1/2 rounded-full bg-zinc-900" />
        </div>
        <button
          type="button"
          className="flex size-8 cursor-pointer items-center justify-center rounded-full text-zinc-400 transition-colors hover:text-zinc-900"
          onClick={() => zoomCenter(zoom / 1.4, true)}
        >
          <Minus size={18} strokeWidth={1.75} />
        </button>
        {/* fixed width so the number/icon swap can't shift the hover target
            out from under the cursor */}
        <button
          type="button"
          className="group flex h-8 w-10 cursor-pointer items-center justify-center pb-0.5 font-mono text-base text-zinc-500 transition-colors hover:text-zinc-900"
          onClick={resetView}
          title="reset view"
        >
          <span className="group-hover:hidden">{Math.round(zoom * 100)}</span>
          <RotateCcw size={16} strokeWidth={1.75} className="hidden group-hover:block" />
        </button>
      </div>

      {/* note toggle, bottom center */}
      <div
        className="rise-in group absolute bottom-5 left-1/2 -translate-x-1/2"
        style={{ animationDelay: "240ms" }}
      >
        <div className="glass pointer-events-none absolute bottom-full left-1/2 mb-2.5 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
          <span className="text-base font-medium text-zinc-700">
            {noteMode ? "Cancel" : "Add note"}
          </span>
          <kbd className="rounded-md bg-black/[0.05] px-1.5 py-0.5 font-mono text-base text-zinc-400">
            {noteMode ? "esc" : "C"}
          </kbd>
        </div>
        <button
          type="button"
          className={`flex h-13 cursor-pointer items-center gap-2.5 rounded-full px-6 text-base font-medium transition-all ${
            noteMode
              ? "bg-amber-400 text-white shadow-[0_4px_20px_rgba(217,119,6,0.4)]"
              : "glass text-zinc-600 hover:text-zinc-900"
          }`}
          onClick={() => {
            setNoteMode((prev) => !prev)
            setPending(undefined)
          }}
          data-bench-note-toggle=""
        >
          <MessageSquarePlus size={20} strokeWidth={1.75} />
          {noteMode ? "Cancel" : "Add note"}
        </button>
      </div>

      {/* knobs panel, right */}
      <aside
        className="glass smooth-corners rise-in absolute right-5 top-[84px] flex max-h-[calc(100vh-10rem)] w-80 flex-col overflow-hidden"
        style={{ animationDelay: "120ms" }}
        onWheel={(e) => e.stopPropagation()}
      >
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          {Object.keys(fixture?.states ?? {}).length > 1 && (
            <div className="mb-2 border-b border-black/[0.05] pb-4 pt-1">
              <div className="flex flex-wrap gap-1.5">
                {Object.keys(fixture?.states ?? {}).map((name) => (
                  <button
                    key={name}
                    type="button"
                    className={`cursor-pointer rounded-full px-3 py-1 font-mono text-base transition-colors ${
                      activeFixtureState === name
                        ? "bg-zinc-900 text-white"
                        : "text-zinc-400 hover:text-zinc-900"
                    }`}
                    onClick={() =>
                      setSearchParams(
                        new URLSearchParams({
                          ...fixtureState("default"),
                          ...fixtureState(name),
                        })
                      )
                    }
                    data-bench-fixture={name}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {spec.props
            .filter((p) => p.kind !== "boolean")
            .map((prop) => (
              <Knob
                key={prop.name}
                prop={prop}
                value={knobValues[prop.name]}
                onChange={(value) => setKnob(prop.name, value)}
              />
            ))}

          {/* boolean toggles sit two-up in a grid */}
          <div className="grid grid-cols-2 gap-x-5">
            {spec.props
              .filter((p) => p.kind === "boolean")
              .map((prop) => (
                <Knob
                  key={prop.name}
                  prop={prop}
                  value={knobValues[prop.name]}
                  onChange={(value) => setKnob(prop.name, value)}
                />
              ))}
          </div>

          {spec.usages.length > 0 && (
            <div className="mt-2 border-t border-black/[0.05] pt-3">
              {spec.usages.map((usage) => (
                <a
                  key={`${usage.file}:${usage.line}`}
                  href={`vscode://file/${manifest.root}/${usage.file}:${usage.line}`}
                  className="block cursor-pointer py-1.5 font-mono text-base text-zinc-400 transition-colors hover:text-zinc-900"
                  title={usage.snippet}
                >
                  {usage.file.replace("src/", "")}:{usage.line}
                  {usage.internal && (
                    <span className="ml-2 rounded-md bg-black/[0.04] px-1.5 py-0.5 text-[13px] text-zinc-400">
                      internal
                    </span>
                  )}
                </a>
              ))}
            </div>
          )}
        </div>

        {/* copy a shareable link to the exact state on screen; pinned below
            the scrolling content */}
        <div className="shrink-0 border-t border-black/[0.05] p-3">
          <button
            type="button"
            className="flex w-full cursor-pointer items-center justify-center gap-2.5 rounded-2xl bg-black/[0.04] py-3 text-base font-medium text-zinc-600 transition-colors hover:bg-black/[0.06] hover:text-zinc-900"
            onClick={copyUrl}
            title="Copies a URL that reopens this component with exactly these knob values"
            data-bench-copy-state=""
          >
            {copied ? (
              <>
                <Check size={18} strokeWidth={1.75} />
                copied
              </>
            ) : (
              <>
                <Link2 size={18} strokeWidth={1.75} />
                copy link to this state
              </>
            )}
          </button>
        </div>
      </aside>
    </div>
  )
}
