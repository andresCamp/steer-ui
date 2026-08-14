// Page notes on a live dashboard. Same note UI as the workshop: amber pins,
// optional regions, glass threads. "State" here is route + viewport band.
// Pins from another band fade; click snaps back to that band.

import {
  captureAnchor,
  captureRegion,
  layeredV2,
  nearestAnchorable,
  resolveRegion,
  type Anchor,
  type Box,
  type RegionAnchor,
} from "./anchor"
import { INITIAL, renderDashboard, type DashState } from "./dashboard"
import type { SteerNote } from "../../../src/core/model"
import {
  createNote,
  moveNoteById,
  replyToNoteById,
  resolveNoteById,
  type NoteContext,
} from "../../../src/core/notes"
import { parseStateUrl } from "../../../src/core/state-url"

/** SteerNote plus the one thing a page note needs that a bench note does not. */
interface PageNote extends SteerNote {
  anchor: Anchor
  /** Present when the note has a region. Members, not fractions, are what
   *  make the region survive; SteerNote.rect stays the live geometry. */
  region?: RegionAnchor
}

const KEY = "steer-ui:anchor-demo"
const SHAPE = 5
/** The surface id: a route, where the workshop would use a component slug. */
const SURFACE = "page:/revenue"
const AUTHOR = "andres"
const BENCH = "http://localhost:5199/__steer"

// Bands follow the dashboard's own breakpoints, so a fade always means the
// layout actually changed.
const BANDS = [
  { id: "xl", min: 1100, snap: 1280 },
  { id: "lg", min: 1000, snap: 1040 },
  { id: "md", min: 900, snap: 940 },
  { id: "sm", min: 560, snap: 720 },
  { id: "xs", min: 0, snap: 420 },
] as const

type Band = (typeof BANDS)[number]["id"]

function isBand(v: string): v is Band {
  return BANDS.some((b) => b.id === v)
}

function bandOf(width: number): (typeof BANDS)[number] {
  return BANDS.find((b) => width >= b.min) ?? BANDS[BANDS.length - 1]
}

function pageStateUrl(band: Band): string {
  return `${SURFACE}?band=${band}`
}

let seq = 0
const ctx: NoteContext = {
  now: () => new Date().toISOString(),
  id: (prefix) => `${prefix}-${Date.now().toString(36)}-${(seq++).toString(36)}`,
}

const frame = document.querySelector("#frame") as HTMLElement
const app = document.querySelector("#app") as HTMLElement
const layer = document.querySelector("#layer") as HTMLElement
const peekRoot = document.querySelector("#peek") as HTMLElement
const peekDot = document.querySelector("#peek-dot") as HTMLButtonElement
const peekCount = document.querySelector("#peek-count") as HTMLElement
const peekAdd = document.querySelector("#peek-add") as HTMLButtonElement
const peekAddText = document.querySelector("#peek-add-text") as HTMLElement
const peekAddKey = document.querySelector("#peek-add-key") as HTMLElement
const peekEye = document.querySelector("#peek-eye") as HTMLButtonElement
const peekWidth = document.querySelector("#peek-width") as HTMLElement
const peekSplit = document.querySelector("#peek-split") as HTMLElement
const peekBench = document.querySelector("#peek-bench") as HTMLAnchorElement

let state: DashState = { ...INITIAL }
let notes: PageNote[] = []
let noteMode = false
let peekOpen = true
let pinsVisible = true
let openPin: string | null = null
let hover: { x: number; y: number } | null = null
let marquee: Box | null = null
let dragStart: { x: number; y: number } | null = null
let regionOverride: { id: string; box: Box } | null = null
// A pin held by the cursor, in client space. While a gesture is in flight the
// pin belongs to the cursor and to nothing else — not to a region corner.
let pinOverride: { id: string; at: { x: number; y: number } } | null = null
let widthLock: number | null = null
let allowUnlock = true
let pending: {
  anchor: Anchor
  coords: { x: number; y: number }
  rect?: PageNote["rect"]
  region?: RegionAnchor
  el: Element
} | null = null

function currentWidth(): number {
  return widthLock ?? window.innerWidth
}

function noteBand(n: PageNote): Band {
  const fromUrl = parseStateUrl(n.stateUrl).values.band
  if (fromUrl && isBand(fromUrl)) return fromUrl
  return bandOf(n.anchor.viewport.w).id
}

function noteMatchesState(n: PageNote): boolean {
  return noteBand(n) === bandOf(currentWidth()).id
}

function stampViewport(anchor: Anchor): Anchor {
  return { ...anchor, viewport: { w: currentWidth(), h: window.innerHeight } }
}

function applyWidthLock(width: number | null): void {
  widthLock = width
  if (width == null) {
    frame.style.width = ""
    frame.style.marginInline = ""
    document.body.classList.remove("band-locked")
    return
  }
  frame.style.width = `${width}px`
  frame.style.marginInline = "auto"
  document.body.classList.add("band-locked")
}

function snapToBand(band: Band): void {
  const spec = BANDS.find((b) => b.id === band)!
  const before = window.innerWidth
  allowUnlock = false
  try {
    window.resizeTo(spec.snap, window.outerHeight)
  } catch {
    /* a tab cannot resize itself */
  }
  requestAnimationFrame(() => {
    if (Math.abs(window.innerWidth - spec.snap) > 48) {
      applyWidthLock(spec.snap)
    } else if (Math.abs(window.innerWidth - before) < 2) {
      applyWidthLock(spec.snap)
    }
    allowUnlock = true
    render()
  })
}

function jumpToNote(n: PageNote): void {
  pinsVisible = true
  if (!noteMatchesState(n)) snapToBand(noteBand(n))
  openPin = n.id
  render()
}

function benchHref(): string {
  const n = notes.find((x) => x.id === openPin)
  const file = n?.anchor.source?.file ?? ""
  // Layout notes stay on the workshop index. A component instance would
  // slug from its source file and open that page.
  if (!file || /\/pages\//.test(file)) return BENCH
  const raw = file.split("/").pop()?.replace(/\.tsx?$/, "") ?? ""
  if (!raw) return BENCH
  const slug = raw.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase()
  return `${BENCH}/${slug}`
}

// ------------------------------------------------------------------ storage

function save(): void {
  localStorage.setItem(KEY, JSON.stringify({ shape: SHAPE, notes }))
}

function load(): PageNote[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as { shape?: number; notes?: PageNote[] }
    if (parsed.shape !== SHAPE || !Array.isArray(parsed.notes)) return []
    return parsed.notes
  } catch {
    return []
  }
}

// -------------------------------------------------------------------- seeds

interface Seed {
  demo?: string
  /** A region drawn across a set of demo-marked elements. */
  span?: [string, string]
  /** A note dropped in the page gutter, anchored to no element in particular. */
  gutter?: boolean
  /** Force a band so a desktop load already shows faded pins. */
  band?: Band
  text: string
  author?: string
  replies?: { author: string; text: string }[]
}

const SEEDS: Seed[] = [
  {
    demo: "kpi-value",
    text: "This should be the hero. The label is out-shouting it.",
  },
  {
    demo: "churn-delta",
    text: "Red reads as an error state. Use neutral plus a down arrow.",
    replies: [{ author: "agent", text: "Switched to zinc-500 with a caret. Pushed as 3f10c2a." }],
  },
  {
    span: ["kpi-value", "churn-delta"],
    text: "These four tiles need one shared baseline. The values do not line up.",
  },
  {
    demo: "legend",
    text: "Legend is too far from the series it names.",
  },
  {
    span: ["top-amount", "foot-note"],
    band: "xs",
    text: "Whole block reads heavy. Tighten the row rhythm before the type.",
    author: "agent",
  },
  {
    gutter: true,
    band: "sm",
    text: "Page has no empty state. What does this look like on day one?",
  },
]

function seedNotes(): void {
  notes = []
  for (const s of SEEDS) {
    let el: Element | null = null
    let coords = { x: 0.5, y: 0.5 }
    let rect: PageNote["rect"]
    let region: RegionAnchor | undefined
    let anchor: Anchor

    if (s.span) {
      const a = app.querySelector(`[data-demo-id="${s.span[0]}"]`)
      const b = app.querySelector(`[data-demo-id="${s.span[1]}"]`)
      if (!a || !b) continue
      const ra = a.getBoundingClientRect()
      const rb = b.getBoundingClientRect()
      const box: Box = {
        left: Math.min(ra.left, rb.left) - 8,
        top: Math.min(ra.top, rb.top) - 8,
        width: Math.abs(Math.max(ra.right, rb.right) - Math.min(ra.left, rb.left)) + 16,
        height: Math.abs(Math.max(ra.bottom, rb.bottom) - Math.min(ra.top, rb.top)) + 16,
      }
      region = captureRegion(app, box)
      el = app
      rect = region.rect
      coords = { x: rect.x + rect.w, y: rect.y }
      anchor = region.container
    } else if (s.gutter) {
      const r = app.getBoundingClientRect()
      el = app
      coords = { x: 0.055, y: 0.58 }
      anchor = captureAnchor(app, r.left, r.top, app, true)
    } else {
      const hit = app.querySelector(`[data-demo-id="${s.demo}"]`)
      if (!hit) continue
      const found = nearestAnchorable(hit, app)
      el = found.el
      const r = el.getBoundingClientRect()
      coords = { x: 0.5, y: 0.5 }
      anchor = captureAnchor(el, r.left + r.width / 2, r.top + r.height / 2, app, found.viaAncestor)
    }

    const band = s.band ?? bandOf(currentWidth()).id
    if (s.band) {
      const spec = BANDS.find((b) => b.id === s.band)!
      anchor = { ...anchor, viewport: { ...anchor.viewport, w: spec.snap } }
    } else {
      anchor = stampViewport(anchor)
    }

    const made = createNote(
      notes,
      SURFACE,
      {
        stateUrl: pageStateUrl(band),
        selector: anchor.stableSelector ?? anchor.path,
        coords,
        rect,
        text: s.text,
        author: s.author ?? AUTHOR,
      },
      ctx,
    )
    notes = made.notes.map((n) =>
      n.id === made.note.id ? { ...n, anchor, region } : (n as PageNote),
    )
    for (const rep of s.replies ?? []) {
      const withReply = replyToNoteById(notes, made.note.id, rep, ctx)
      if (withReply) notes = withReply.notes as PageNote[]
    }
  }
  save()
}

// -------------------------------------------------------------------- render

function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (seconds < 60) return "now"
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`
  return `${Math.floor(seconds / 86400)}d`
}

function elFor(n: PageNote): Element | null {
  return layeredV2(n.anchor, app)
}

const openNotes = (): PageNote[] => notes.filter((n) => n.status === "open")

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const n = document.createElement(tag)
  if (cls) n.className = cls
  if (text) n.textContent = text
  return n
}

function syncPeek(): void {
  const open = openNotes()
  const here = open.filter(noteMatchesState).length
  const away = open.length - here
  const band = bandOf(currentWidth())
  const w = currentWidth()

  peekRoot.toggleAttribute("data-expanded", peekOpen)
  peekCount.textContent = String(open.length)
  peekDot.title = peekOpen ? "Collapse" : `${open.length} notes`

  peekAdd.classList.toggle("on", noteMode)
  peekAddText.textContent = noteMode ? "Cancel" : "Add note"
  peekAddKey.textContent = noteMode ? "esc" : "C"

  peekEye.classList.toggle("muted", !pinsVisible)
  peekEye.setAttribute("aria-pressed", String(pinsVisible))
  peekEye.title = pinsVisible ? "Hide pins" : "Show pins"
  peekEye.setAttribute("aria-label", peekEye.title)
  peekEye.querySelector(".eye-on")?.toggleAttribute("hidden", !pinsVisible)
  peekEye.querySelector(".eye-off")?.toggleAttribute("hidden", pinsVisible)

  const split = `${here} here · ${away} at other widths`
  peekWidth.textContent = `${w}px · ${band.id}`
  peekSplit.textContent = split
  peekWidth.parentElement!.title = split
  peekBench.href = benchHref()
}

function render(): void {
  layer.replaceChildren()

  if (noteMode && !pending && !marquee && hover) {
    const g = el("div", "ghost-pin")
    g.style.cssText = `left:${hover.x}px;top:${hover.y}px`
    g.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>`
    layer.append(g)
  }

  if (marquee) {
    const m = el("div", "marquee")
    m.style.cssText = `left:${marquee.left}px;top:${marquee.top}px;width:${marquee.width}px;height:${marquee.height}px`
    layer.append(m)
  }

  if (pinsVisible) {
    openNotes().forEach((n, i) => {
      const target = elFor(n)
      if (!target) {
        renderOrphan(n, i)
        return
      }
      const here = noteMatchesState(n)
      const box = target.getBoundingClientRect()

      if (here && n.rect && n.region) {
        const b = regionOverride?.id === n.id ? regionOverride.box : resolveRegion(app, n.region)
        if (!b) return
        const region = el("div", `region${openPin === n.id ? " open" : ""}${noteMode ? " inert" : ""}`)
        region.style.cssText = `left:${b.left}px;top:${b.top}px;width:${b.width}px;height:${b.height}px`
        for (const [cx, cy, cls] of [
          [0, 0, "nw"],
          [1, 0, "ne"],
          [0, 1, "sw"],
          [1, 1, "se"],
        ] as [0 | 1, 0 | 1, string][]) {
          const h = el("div", `handle ${cls}`)
          h.append(el("i"))
          h.addEventListener("pointerdown", resizeRegion(n, cx, cy))
          region.append(h)
        }
        region.addEventListener("pointerdown", dragNote(n))
        layer.append(region)
      }

      // The pin is a stored position, never a corner of its region: coords
      // place it, and a gesture in flight hands it to the cursor.
      let x: number
      let y: number
      if (pinOverride?.id === n.id) {
        x = pinOverride.at.x
        y = pinOverride.at.y
      } else {
        x = Math.min(box.left + n.coords.x * box.width, window.innerWidth - 18)
        y = box.top + n.coords.y * box.height
      }

      const holder = el("div", "note")
      holder.style.cssText = `left:${x}px;top:${y}px`
      holder.setAttribute("data-steer-note-id", n.id)

      const pinCls = [
        "pin",
        n.author === "agent" ? "agent" : "",
        here ? "" : "away",
      ]
        .filter(Boolean)
        .join(" ")
      const pin = el("button", pinCls, String(i + 1))
      pin.type = "button"
      if (!here) pin.title = "Note from another viewport · click to jump to it"
      pin.addEventListener("pointerdown", dragNote(n))
      holder.append(pin)

      if (here && openPin === n.id) holder.append(thread(n, y))
      layer.append(holder)
    })
  }

  if (pending) layer.append(composer())
  syncPeek()
}

/** An orphaned note is not silently dropped; it is parked and labelled. */
function renderOrphan(n: PageNote, i: number): void {
  const holder = el("div", "note orphan")
  holder.style.cssText = `left:${12}px;top:${16 + i * 34}px`
  holder.setAttribute("data-steer-note-id", n.id)
  const pin = el("button", "pin orphaned", String(i + 1))
  pin.title = `orphaned · ${n.text}`
  pin.addEventListener("click", (e) => {
    e.stopPropagation()
    openPin = openPin === n.id ? null : n.id
    render()
  })
  holder.append(pin, el("span", "orphan-tag", "orphaned"))
  if (openPin === n.id) holder.append(thread(n, 16 + i * 34))
  layer.append(holder)
}

function thread(n: PageNote, y = 400): HTMLElement {
  const panel = el("div", `glass popover${y < 300 ? " down" : ""}`)
  panel.addEventListener("pointerdown", (e) => e.stopPropagation())
  panel.addEventListener("click", (e) => e.stopPropagation())

  const head = el("div", "pop-head")
  const who = el("span", "pop-who")
  who.append(
    el("span", `pop-author${n.author === "agent" ? " agent" : ""}`, n.author),
    el("span", "pop-time", timeAgo(n.created)),
  )
  const res = el("button", "pop-resolve", "resolve")
  res.type = "button"
  res.addEventListener("click", () => {
    const next = resolveNoteById(notes, n.id)
    if (next) notes = next.notes as PageNote[]
    openPin = null
    save()
    render()
  })
  head.append(who, res)
  panel.append(head, el("p", "pop-text", n.text))

  if ((n.replies ?? []).length) {
    const list = el("div", "pop-replies")
    for (const r of n.replies ?? []) {
      const item = el("div")
      const meta = el("span", "pop-who")
      meta.append(
        el("span", `pop-author${r.author === "agent" ? " agent" : ""}`, r.author),
        el("span", "pop-time", timeAgo(r.created)),
      )
      item.append(meta, el("p", "pop-text", r.text))
      list.append(item)
    }
    panel.append(list)
  }

  const input = el("input", "pop-reply")
  input.type = "text"
  input.placeholder = "Reply…"
  input.setAttribute("data-steer-reply-input", "")
  input.addEventListener("keydown", (e) => {
    e.stopPropagation()
    if (e.key !== "Enter" || !input.value.trim()) return
    const next = replyToNoteById(notes, n.id, { text: input.value.trim(), author: AUTHOR }, ctx)
    if (next) notes = next.notes as PageNote[]
    save()
    render()
  })
  panel.append(input)
  return panel
}

function composer(): HTMLElement {
  const p = pending!
  const box = p.el.getBoundingClientRect()
  const x = box.left + p.coords.x * box.width
  const y = box.top + p.coords.y * box.height

  const panel = el("div", "glass composer")
  panel.style.cssText = `left:${x}px;top:${y}px`
  panel.addEventListener("pointerdown", (e) => e.stopPropagation())

  const ta = el("textarea", "comp-text")
  ta.placeholder = "What feels off?"
  ta.setAttribute("data-steer-note-input", "")

  const foot = el("div", "comp-foot")
  const sel = el("span", "comp-sel", p.anchor.source
    ? `${p.anchor.source.file.split("/").pop()}:${p.anchor.source.line}`
    : p.anchor.stableSelector ?? p.el.tagName.toLowerCase())
  sel.title = p.anchor.source
    ? `${p.anchor.source.file}:${p.anchor.source.line}:${p.anchor.source.col}`
    : p.anchor.path
  const actions = el("div", "comp-actions")
  const cancel = el("button", "comp-cancel", "cancel")
  cancel.type = "button"
  cancel.addEventListener("click", () => {
    pending = null
    render()
  })
  const pin = el("button", "comp-pin", "pin")
  pin.type = "button"
  pin.setAttribute("data-steer-note-save", "")
  const commit = () => {
    const text = ta.value.trim()
    if (!text) return
    const band = bandOf(currentWidth()).id
    const anchor = stampViewport(p.anchor)
    const made = createNote(
      notes,
      SURFACE,
      {
        stateUrl: pageStateUrl(band),
        selector: anchor.stableSelector ?? anchor.path,
        coords: p.coords,
        rect: p.rect,
        text,
        author: AUTHOR,
      },
      ctx,
    )
    const region = p.region
    notes = made.notes.map((n) =>
      n.id === made.note.id ? { ...n, anchor, region } : (n as PageNote),
    )
    pending = null
    save()
    render()
  }
  pin.addEventListener("click", commit)
  ta.addEventListener("keydown", (e) => {
    e.stopPropagation()
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      commit()
    }
    if (e.key === "Escape") {
      pending = null
      render()
    }
  })
  actions.append(cancel, pin)
  foot.append(sel, actions)
  panel.append(ta, foot)
  requestAnimationFrame(() => ta.focus())
  return panel
}

// ----------------------------------------------------------------- dragging

/** Client point → fractions of the element a note's coords are measured against. */
function coordsIn(container: Element | null, at: { x: number; y: number }): { x: number; y: number } | null {
  const box = container?.getBoundingClientRect()
  if (!box || !box.width || !box.height) return null
  return { x: (at.x - box.left) / box.width, y: (at.y - box.top) / box.height }
}

/**
 * Commit a region's new box: re-capture the elements it now covers, and land
 * the pin where the cursor left it rather than back on a corner.
 */
function commitRegion(n: PageNote, box: Box, pinAt?: { x: number; y: number }): void {
  const captured = captureRegion(app, box)
  const coords =
    (pinAt && coordsIn(layeredV2(captured.container, app), pinAt)) ??
    { x: captured.rect.x + captured.rect.w, y: captured.rect.y }
  const next = moveNoteById(notes, n.id, coords, captured.rect)
  if (!next) return
  notes = next.notes.map((x) =>
    x.id === n.id ? ({ ...(x as PageNote), anchor: stampViewport(captured.container), region: captured }) : (x as PageNote),
  )
  regionOverride = null
  pinOverride = null
  save()
  render()
}

function dragNote(n: PageNote) {
  return (e: PointerEvent) => {
    if (noteMode) return
    e.stopPropagation()
    e.preventDefault()

    if (!noteMatchesState(n)) {
      const up = () => {
        window.removeEventListener("pointerup", up)
        jumpToNote(n)
      }
      window.addEventListener("pointerup", up)
      return
    }

    const sx = e.clientX
    const sy = e.clientY
    let moved = false

    const startBox = n.region ? resolveRegion(app, n.region) : null
    const target = n.region ? null : elFor(n)
    const box = target?.getBoundingClientRect()
    const c0 = { ...n.coords }

    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - sx
      const dy = ev.clientY - sy
      if (Math.abs(dx) + Math.abs(dy) > 3) moved = true
      if (!moved) return
      // The pin goes where the cursor goes, whether the grab landed on the
      // pin itself or anywhere in its region.
      pinOverride = { id: n.id, at: { x: ev.clientX, y: ev.clientY } }
      if (startBox) {
        regionOverride = { id: n.id, box: { ...startBox, left: startBox.left + dx, top: startBox.top + dy } }
      }
      render()
    }
    const up = () => {
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", up)
      if (!moved) {
        regionOverride = null
        pinOverride = null
        openPin = openPin === n.id ? null : n.id
        render()
        return
      }
      const at = pinOverride?.at
      if (regionOverride) {
        commitRegion(n, regionOverride.box, at)
        return
      }
      // A plain pin: store the cursor as fractions of the element it hangs off.
      const coords = at ? coordsIn(target, at) : null
      if (coords) {
        const next = moveNoteById(notes, n.id, coords)
        if (next) notes = next.notes as PageNote[]
      }
      pinOverride = null
      save()
      render()
    }
    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", up)
  }
}

/** Resize a region by a corner; the opposite corner anchors. */
function resizeRegion(n: PageNote, cx: 0 | 1, cy: 0 | 1) {
  return (e: PointerEvent) => {
    if (noteMode) return
    e.stopPropagation()
    e.preventDefault()
    const start = resolveRegion(app, n.region!)
    if (!start) return
    const sx = e.clientX
    const sy = e.clientY

    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - sx
      const dy = ev.clientY - sy
      const left = cx === 0 ? start.left + dx : start.left
      const top = cy === 0 ? start.top + dy : start.top
      const w = cx === 0 ? start.width - dx : start.width + dx
      const h = cy === 0 ? start.height - dy : start.height + dy
      regionOverride = {
        id: n.id,
        box: {
          left: w < 0 ? left + w : left,
          top: h < 0 ? top + h : top,
          width: Math.abs(w),
          height: Math.abs(h),
        },
      }
      // Resizing is a gesture too: the pin rides the corner being pulled.
      pinOverride = { id: n.id, at: { x: ev.clientX, y: ev.clientY } }
      render()
    }
    const up = () => {
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", up)
      if (regionOverride) commitRegion(n, regionOverride.box, pinOverride?.at)
    }
    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", up)
  }
}

// ---------------------------------------------------------------- note mode

function setPeekOpen(on: boolean): void {
  peekOpen = on
  if (on) pinsVisible = true
  render()
}

function setPinsVisible(on: boolean): void {
  pinsVisible = on
  render()
}

function setNoteMode(on: boolean): void {
  noteMode = on
  pending = null
  marquee = null
  dragStart = null
  if (on) {
    peekOpen = true
    pinsVisible = true
  }
  document.body.classList.toggle("noting", on)
  render()
}

app.addEventListener("pointerdown", (e) => {
  if (!noteMode || pending) return
  e.preventDefault()
  dragStart = { x: e.clientX, y: e.clientY }
})

window.addEventListener("pointermove", (e) => {
  if (!noteMode) return
  if (dragStart) {
    const box: Box = {
      left: Math.min(dragStart.x, e.clientX),
      top: Math.min(dragStart.y, e.clientY),
      width: Math.abs(e.clientX - dragStart.x),
      height: Math.abs(e.clientY - dragStart.y),
    }
    marquee = box.width + box.height > 8 ? box : null
  } else {
    hover = { x: e.clientX, y: e.clientY }
  }
  render()
})

window.addEventListener("pointerup", (e) => {
  if (!noteMode || !dragStart) return
  const start = dragStart
  const region = marquee
  dragStart = null
  marquee = null

  if (region) {
    const captured = captureRegion(app, region)
    pending = {
      el: app,
      anchor: stampViewport(captured.container),
      region: captured,
      // The pin lands where the drag ended, not on a corner of what it drew.
      coords:
        coordsIn(layeredV2(captured.container, app), { x: e.clientX, y: e.clientY }) ??
        { x: captured.rect.x + captured.rect.w, y: captured.rect.y },
      rect: captured.rect,
    }
  } else {
    const hit = document.elementFromPoint(start.x, start.y)
    if (hit && peekRoot.contains(hit)) {
      setNoteMode(false)
      return
    }
    const found = nearestAnchorable(hit && app.contains(hit) ? hit : app, app)
    const box = found.el.getBoundingClientRect()
    pending = {
      el: found.el,
      anchor: stampViewport(captureAnchor(found.el, start.x, start.y, app, found.viaAncestor)),
      coords: {
        x: box.width ? (start.x - box.left) / box.width : 0.5,
        y: box.height ? (start.y - box.top) / box.height : 0.5,
      },
    }
  }
  noteMode = false
  document.body.classList.remove("noting")
  render()
})

layer.addEventListener("pointerdown", () => {
  if (openPin) {
    openPin = null
    render()
  }
})

// ----------------------------------------------------------------- peek

peekDot.addEventListener("click", () => setPeekOpen(!peekOpen))
peekAdd.addEventListener("click", () => setNoteMode(!noteMode))
peekEye.addEventListener("click", () => setPinsVisible(!pinsVisible))

function shuffleApp(): void {
  state = {
    dataset: state.dataset === 0 ? 1 : 0,
    showActivity: !state.showActivity,
    extraRow: !state.extraRow,
    lineShift: state.lineShift === 0 ? 7 : 0,
  }
  renderDashboard(app, state)
  requestAnimationFrame(render)
}

function resetApp(): void {
  state = { ...INITIAL }
  applyWidthLock(null)
  renderDashboard(app, state)
  requestAnimationFrame(() => {
    seedNotes()
    render()
  })
}

window.addEventListener("keydown", (e) => {
  const typing = e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement
  if (e.key === "c" && !typing && !e.metaKey && !e.ctrlKey) setNoteMode(!noteMode)
  if (e.key === "Escape") {
    pending = null
    openPin = null
    setNoteMode(false)
  }
  if (e.key === "S" && e.shiftKey && !typing) shuffleApp()
  if (e.key === "R" && e.shiftKey && !typing) resetApp()
})

window.addEventListener("resize", () => {
  if (allowUnlock && widthLock != null) applyWidthLock(null)
  render()
})
window.addEventListener("scroll", render, { passive: true })
new ResizeObserver(() => render()).observe(app)

// ---------------------------------------------------------------------- boot

renderDashboard(app, state)
notes = load()
requestAnimationFrame(() => {
  if (!notes.length) seedNotes()
  render()
})
