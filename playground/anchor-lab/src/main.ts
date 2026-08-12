// The lab surface. Two things at once: a scored matrix (does the strategy find
// the element) and a live pin view (where the pin actually lands), because a
// table alone hides the failure mode that matters — a note that confidently
// moves to the wrong place.

import { captureAnchor, pinPoint, STRATEGIES, type Anchor, type Strategy } from "./anchor"
import { BASELINE, renderPage, TARGETS, type SpecOpts } from "./page"
import { ALL_SCENARIOS, runLab, type LabResult } from "./harness"

const $ = <T extends Element = HTMLElement>(sel: string): T =>
  document.querySelector(sel) as unknown as T

const specimen = $("#specimen") as HTMLElement
const overlay = $("#pins") as HTMLElement
const matrix = $("#matrix") as HTMLElement
const summary = $("#summary") as HTMLElement
const scenarioSel = $("#scenario") as HTMLSelectElement
const strategySel = $("#strategy") as HTMLSelectElement

let anchors: Record<string, Anchor> = {}

for (const s of ALL_SCENARIOS) {
  const o = document.createElement("option")
  o.value = s.id
  o.textContent = `${s.id} — ${s.detail}`
  scenarioSel.append(o)
}
for (const st of STRATEGIES) {
  const o = document.createElement("option")
  o.value = st.id
  o.textContent = st.label
  strategySel.append(o)
}
strategySel.value = "layered"

function frame(): Promise<void> {
  return new Promise((r) => requestAnimationFrame(() => r()))
}

/** Capture the eight notes against a clean baseline render. */
async function capture(): Promise<void> {
  specimen.style.width = ""
  document.documentElement.style.fontSize = ""
  renderPage(specimen, BASELINE)
  await frame()
  anchors = {}
  for (const t of TARGETS) {
    const el = specimen.querySelector(`[data-truth-id="${t.truth}"]`)
    if (!el) continue
    const r = el.getBoundingClientRect()
    anchors[t.truth] = captureAnchor(el, r.left + r.width * 0.3, r.top + r.height * 0.6, specimen)
  }
}

function drawPins(fn: Strategy): void {
  overlay.replaceChildren()
  const host = specimen.getBoundingClientRect()
  for (const t of TARGETS) {
    const a = anchors[t.truth]
    if (!a) continue
    const truth = specimen.querySelector(`[data-truth-id="${t.truth}"]`)
    const got = fn(a, specimen)

    // Ghost: where a naive absolute-coordinate pin would sit today.
    const ghost = document.createElement("div")
    ghost.className = "pin ghost"
    ghost.style.left = `${a.pageCoords.x - window.scrollX - host.left}px`
    ghost.style.top = `${a.pageCoords.y - window.scrollY - host.top}px`
    ghost.title = `${t.truth}: stored absolute point`
    overlay.append(ghost)

    if (!got) {
      if (truth) {
        const p = pinPoint(truth, a)
        const orph = document.createElement("div")
        orph.className = "pin orphan"
        orph.style.left = `${p.x - window.scrollX - host.left}px`
        orph.style.top = `${p.y - window.scrollY - host.top}px`
        orph.textContent = "?"
        orph.title = `${t.truth}: orphaned — element exists but was not found`
        overlay.append(orph)
      }
      continue
    }

    const p = pinPoint(got, a)
    const pin = document.createElement("div")
    const ok = got === truth
    pin.className = `pin ${ok ? "ok" : "bad"}`
    pin.style.left = `${p.x - window.scrollX - host.left}px`
    pin.style.top = `${p.y - window.scrollY - host.top}px`
    pin.textContent = ok ? "" : "✕"
    pin.title = ok
      ? `${t.truth}: correct`
      : `${t.truth}: WRONG — landed on ${got.getAttribute("data-truth-id") ?? got.tagName.toLowerCase()}`
    overlay.append(pin)
  }
}

async function applyScenario(): Promise<void> {
  const s = ALL_SCENARIOS.find((x) => x.id === scenarioSel.value)
  if (!s) return
  const opts: SpecOpts = { ...BASELINE, ...s.opts }
  document.documentElement.style.fontSize = s.env?.fontScale ? `${16 * s.env.fontScale}px` : ""
  specimen.style.width = s.env?.hostWidth ?? ""
  renderPage(specimen, opts)
  await frame()
  const st = STRATEGIES.find((x) => x.id === strategySel.value)
  if (st) drawPins(st.fn)
}

function pct(n: number, total: number): string {
  return total ? `${Math.round((n / total) * 100)}%` : "—"
}

function renderResults(res: LabResult): void {
  const order = STRATEGIES.map((s) => s.id)

  const rows = order
    .map((id) => {
      const b = res.byStrategy[id]
      const label = STRATEGIES.find((s) => s.id === id)?.label ?? id
      const cls = b.wrong === 0 ? "good" : b.wrong > 20 ? "bad" : "meh"
      return `<tr class="${cls}">
        <td class="strat">${label}</td>
        <td class="num">${pct(b.correct, b.total)}<span class="raw">${b.correct}</span></td>
        <td class="num">${pct(b.orphaned, b.total)}<span class="raw">${b.orphaned}</span></td>
        <td class="num danger">${pct(b.wrong, b.total)}<span class="raw">${b.wrong}</span></td>
      </tr>`
    })
    .join("")

  summary.innerHTML = `<table class="tbl">
    <thead><tr><th>strategy</th><th>correct</th><th>orphaned</th><th>wrong</th></tr></thead>
    <tbody>${rows}</tbody></table>
    <p class="drift">Absolute vs element-relative placement drift across ${res.drift.samples} resolutions:
      <b>mean ${res.drift.mean.toFixed(0)}px</b>, max ${res.drift.max.toFixed(0)}px.
      Element-relative drift is 0 by construction.</p>`

  // Per-scenario matrix for the layered resolver plus the two source layers.
  const shown = ["path", "stable-sel", "source-exact", "source-fuzzy", "layered", "layered-v2"]
  const head = `<tr><th>scenario</th>${shown
    .map((s) => `<th>${STRATEGIES.find((x) => x.id === s)?.label ?? s}</th>`)
    .join("")}</tr>`
  const body = ALL_SCENARIOS.map((sc) => {
    const cellsFor = (st: string) => {
      const cs = res.cells.filter((c) => c.scenario === sc.id && c.strategy === st)
      const w = cs.filter((c) => c.outcome === "wrong").length
      const o = cs.filter((c) => c.outcome === "orphaned").length
      const k = cs.filter((c) => c.outcome === "correct").length
      const cls = w > 0 ? "bad" : o > 0 ? "meh" : "good"
      const bits = [`${k}✓`]
      if (o) bits.push(`${o}?`)
      if (w) bits.push(`${w}✕`)
      return `<td class="${cls}">${bits.join(" ")}</td>`
    }
    return `<tr><td class="sc"><b>${sc.id}</b><span class="k">${sc.klass}</span><br><span class="d">${sc.detail}</span></td>${shown
      .map(cellsFor)
      .join("")}</tr>`
  }).join("")

  matrix.innerHTML = `<table class="tbl grid">${head}${body}</table>`
}

$("#run").addEventListener("click", async () => {
  matrix.innerHTML = `<p class="muted">running…</p>`
  const res = await runLab(specimen)
  ;(window as unknown as Record<string, unknown>).__anchorLab = res
  renderResults(res)
  await capture()
  await applyScenario()
})

scenarioSel.addEventListener("change", applyScenario)
strategySel.addEventListener("change", applyScenario)
window.addEventListener("resize", applyScenario)

// Expose a headless entry point so the harness can be driven from Playwright.
;(window as unknown as Record<string, unknown>).__runAnchorLab = async () => {
  const res = await runLab(specimen)
  ;(window as unknown as Record<string, unknown>).__anchorLab = res
  renderResults(res)
  await capture()
  await applyScenario()
  return { byStrategy: res.byStrategy, drift: res.drift }
}

await capture()
await applyScenario()
