// Page notes on a live dashboard, resolved by layered v2 on every reflow.
//
// Grab the window edge and drag. The dashboard reflows; the notes stay on the
// thing they were about. Press Shuffle to change the data, the layout and the
// source line numbers underneath them, which is the harder half of the problem.

import { captureAnchor, layeredV2, pinPoint, type Anchor } from "./anchor"
import { INITIAL, renderDashboard, type DashState } from "./dashboard"

interface Note {
  id: string
  text: string
  author: string
  created: string
  anchor: Anchor
}

const KEY = "steer-ui:anchor-demo"

/** Bump when the Anchor shape changes, so stored notes are not silently stale. */
const SHAPE = 2

const app = document.querySelector("#app") as HTMLElement
const layer = document.querySelector("#layer") as HTMLElement
const rail = document.querySelector("#rail") as HTMLElement
const stat = document.querySelector("#stat") as HTMLElement
const dims = document.querySelector("#dims") as HTMLElement
const addBtn = document.querySelector("#add") as HTMLButtonElement
const shuffleBtn = document.querySelector("#shuffle") as HTMLButtonElement
const resetBtn = document.querySelector("#reset") as HTMLButtonElement
const textToggle = document.querySelector("#showtext") as HTMLInputElement

let state: DashState = { ...INITIAL }
let notes: Note[] = []
let placing = false
let active: string | null = null

// ------------------------------------------------------------------ storage

function save(): void {
  localStorage.setItem(KEY, JSON.stringify({ shape: SHAPE, notes }))
}

function load(): Note[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as { shape?: number; notes?: Note[] }
    if (parsed.shape !== SHAPE || !Array.isArray(parsed.notes)) return []
    return parsed.notes
  } catch {
    return []
  }
}

/** Real UI feedback, so the page reads like something mid-review. */
const SEEDS: { demo: string; text: string; at: [number, number] }[] = [
  { demo: "kpi-value", text: "This should be the hero. The label is out-shouting it.", at: [0.5, 0.5] },
  { demo: "churn-delta", text: "Red reads as an error state. Use neutral plus a down arrow.", at: [0.5, 0.5] },
  { demo: "legend", text: "Legend is too far from the series it names.", at: [0.5, 0.5] },
  { demo: "top-amount", text: "Right-align currency and set tabular-nums on this column.", at: [0.6, 0.5] },
  { demo: "foot-note", text: "02:00 UTC means nothing to a sales lead. Say the local time.", at: [0.2, 0.5] },
]

function seed(): void {
  notes = []
  for (const s of SEEDS) {
    const el = app.querySelector(`[data-demo-id="${s.demo}"]`)
    if (!el) continue
    const r = el.getBoundingClientRect()
    notes.push({
      id: s.demo,
      text: s.text,
      author: "andres",
      created: new Date().toISOString(),
      anchor: captureAnchor(el, r.left + r.width * s.at[0], r.top + r.height * s.at[1], app),
    })
  }
  save()
}

// -------------------------------------------------------------------- render

function sync(): void {
  layer.replaceChildren()
  rail.replaceChildren()
  let anchored = 0

  notes.forEach((n, i) => {
    const el = layeredV2(n.anchor, app)
    const num = i + 1

    const item = document.createElement("li")
    item.className = `rail-item${el ? "" : " orphaned"}${active === n.id ? " active" : ""}`
    item.innerHTML = `<span class="rail-num">${num}</span><span class="rail-text"></span>`
    ;(item.querySelector(".rail-text") as HTMLElement).textContent = n.text
    if (!el) item.append(Object.assign(document.createElement("span"), { className: "rail-badge", textContent: "orphaned" }))
    item.addEventListener("mouseenter", () => setActive(n.id))
    item.addEventListener("mouseleave", () => setActive(null))
    rail.append(item)

    if (!el) return
    anchored++

    const p = pinPoint(el, n.anchor)
    const x = p.x - window.scrollX
    const y = p.y - window.scrollY

    // Bubbles open away from whichever edge is closest, so nothing clips when
    // the window gets dragged narrow.
    const flip = x > window.innerWidth - 250
    const up = y > window.innerHeight - 90
    const wrap = document.createElement("div")
    wrap.className = `note${active === n.id ? " active" : ""}${flip ? " flip" : ""}${up ? " up" : ""}`
    wrap.style.left = `${x}px`
    wrap.style.top = `${y}px`

    const pin = document.createElement("button")
    pin.className = "pin"
    pin.textContent = String(num)
    pin.addEventListener("click", (e) => {
      e.stopPropagation()
      setActive(active === n.id ? null : n.id)
    })

    const bubble = document.createElement("div")
    bubble.className = "bubble"
    bubble.textContent = n.text
    const del = document.createElement("button")
    del.className = "bubble-x"
    del.textContent = "×"
    del.title = "delete note"
    del.addEventListener("click", (e) => {
      e.stopPropagation()
      notes = notes.filter((x) => x.id !== n.id)
      save()
      sync()
    })
    bubble.append(del)

    wrap.append(pin, bubble)
    layer.append(wrap)

    // Outline whatever the resolver actually landed on.
    if (active === n.id) {
      const r = el.getBoundingClientRect()
      const ring = document.createElement("div")
      ring.className = "ring"
      ring.style.cssText = `left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px`
      layer.append(ring)
    }
  })

  const orph = notes.length - anchored
  stat.innerHTML = `<b>${notes.length}</b> notes · <b>${anchored}</b> anchored${
    orph ? ` · <b class="warn">${orph}</b> orphaned` : ""
  }`
  dims.textContent = `${window.innerWidth} × ${window.innerHeight}`
  layer.classList.toggle("dots", !textToggle.checked)
}

function setActive(id: string | null): void {
  active = id
  sync()
}

function draw(): void {
  renderDashboard(app, state)
  requestAnimationFrame(sync)
}

// ---------------------------------------------------------------- note mode

function enterPlacing(on: boolean): void {
  placing = on
  document.body.classList.toggle("placing", on)
  addBtn.classList.toggle("on", on)
  addBtn.textContent = on ? "Click an element…" : "Add note  (c)"
}

app.addEventListener(
  "click",
  (e) => {
    if (!placing) return
    e.preventDefault()
    e.stopPropagation()
    const target = e.target as Element
    if (!target || target === app) return
    enterPlacing(false)
    compose(target, e.clientX, e.clientY)
  },
  true,
)

function compose(target: Element, cx: number, cy: number): void {
  const box = document.createElement("div")
  box.className = "composer"
  box.style.left = `${cx}px`
  box.style.top = `${cy}px`
  const ta = document.createElement("textarea")
  ta.placeholder = "What is wrong with this?  ⏎ to save, esc to cancel"
  const hint = document.createElement("div")
  hint.className = "composer-hint"
  const loc = target.getAttribute("data-steer-loc")
  hint.textContent = loc ? `<${target.tagName.toLowerCase()}> · ${loc}` : `<${target.tagName.toLowerCase()}>`
  box.append(ta, hint)
  layer.append(box)
  ta.focus()

  const done = (commit: boolean) => {
    const text = ta.value.trim()
    box.remove()
    if (commit && text) {
      notes.push({
        id: `n${Date.now().toString(36)}`,
        text,
        author: "andres",
        created: new Date().toISOString(),
        anchor: captureAnchor(target, cx, cy, app),
      })
      save()
    }
    sync()
  }
  ta.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      done(true)
    }
    if (e.key === "Escape") done(false)
  })
  ta.addEventListener("blur", () => done(true))
}

// ----------------------------------------------------------------- controls

addBtn.addEventListener("click", () => enterPlacing(!placing))
textToggle.addEventListener("change", sync)

shuffleBtn.addEventListener("click", () => {
  // Data, layout and source line numbers all move at once.
  state = {
    dataset: state.dataset === 0 ? 1 : 0,
    showActivity: !state.showActivity,
    extraRow: !state.extraRow,
    lineShift: state.lineShift === 0 ? 7 : 0,
  }
  draw()
})

resetBtn.addEventListener("click", () => {
  state = { ...INITIAL }
  renderDashboard(app, state)
  requestAnimationFrame(() => {
    seed()
    sync()
  })
})

window.addEventListener("keydown", (e) => {
  if (e.key === "c" && !(e.target instanceof HTMLTextAreaElement)) enterPlacing(!placing)
  if (e.key === "Escape") enterPlacing(false)
})

window.addEventListener("resize", sync)
window.addEventListener("scroll", sync, { passive: true })
new ResizeObserver(() => sync()).observe(app)

// ---------------------------------------------------------------------- boot

renderDashboard(app, state)
notes = load()
requestAnimationFrame(() => {
  if (!notes.length) seed()
  sync()
})
