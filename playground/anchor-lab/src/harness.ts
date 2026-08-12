// Scoring. Capture eight notes on the baseline page, mutate the page twenty-three
// ways, and ask every strategy to find its element again.
//
// Three outcomes, and the ranking between them is the whole argument:
//   correct   found the right element (or honestly returned nothing when the
//             element is genuinely gone)
//   orphaned  found nothing while the element still exists — a miss, but a
//             visible one the operator can act on
//   wrong     confidently returned a different element — a silently misplaced
//             note, which is worse than either. Invariant 4 says degrade
//             visibly; a "wrong" is that invariant being violated.

import { captureAnchor, pinPoint, STRATEGIES, type Anchor } from "./anchor"
import { BASELINE, BASE_ROWS, renderPage, TARGETS, type SpecOpts } from "./page"

export interface Env {
  scrollY?: number
  fontScale?: number
  hostWidth?: string
}

export interface Scenario {
  id: string
  klass: "layout" | "structure" | "source" | "control" | "combined" | "adversarial"
  detail: string
  opts?: Partial<SpecOpts>
  env?: Env
}

export const SCENARIOS: Scenario[] = [
  // Layout: the case most people worry about, and the least dangerous.
  { id: "resize-narrow", klass: "layout", detail: "container 1100 → 420px", env: { hostWidth: "420px" }, opts: { narrow: true } },
  { id: "theme-dark", klass: "layout", detail: "dark theme, different padding", opts: { dark: true } },
  { id: "content-grow", klass: "layout", detail: "copy lengthens, everything reflows", opts: { longText: true } },
  { id: "scrolled", klass: "layout", detail: "page scrolled 600px", env: { scrollY: 600 } },
  { id: "font-scale", klass: "layout", detail: "root font-size 16 → 22px", env: { fontScale: 1.375 } },

  // Structure: the DOM moves under the note.
  { id: "banner-dismissed", klass: "structure", detail: "banner removed, page shifts up", opts: { banner: false } },
  { id: "row-insert", klass: "structure", detail: "row prepended to the list", opts: { rows: ["Zephyr Ltd", ...BASE_ROWS] } },
  { id: "row-reorder", klass: "structure", detail: "list order reversed", opts: { rows: [...BASE_ROWS].reverse() } },
  { id: "row-delete", klass: "structure", detail: "a sibling row deleted", opts: { rows: BASE_ROWS.filter((r) => r !== "Bluebird LLC") } },
  { id: "grid-wrapped", klass: "structure", detail: "card grid wrapped in a new div", opts: { wrapGrid: true } },
  { id: "ids-dropped", klass: "structure", detail: "id attributes removed", opts: { dropIds: true } },

  // Source: what actually happens when a human edits the file.
  { id: "source-line-shift", klass: "source", detail: "import added above: every line +3", opts: { lineShift: 3 } },
  { id: "source-col-shift", klass: "source", detail: "reformat: every column +4", opts: { colShift: 4 } },
  { id: "source-big-shift", klass: "source", detail: "refactor: every line +40", opts: { lineShift: 40 } },
  { id: "source-file-move", klass: "source", detail: "Card.tsx moved to src/ui/primitives/", opts: { fileMove: true } },

  // Control: the element is genuinely gone. Any answer at all is a wrong answer.
  { id: "element-deleted", klass: "control", detail: "3 targets deleted outright", opts: { removed: ["card2-action", "row-cinder-co", "footer-note"] } },

  // Everything at once, which is what a week of work actually looks like.
  {
    id: "realistic-churn",
    klass: "combined",
    detail: "narrow + dark + longer copy + banner gone + rows changed + lines +3",
    env: { hostWidth: "420px" },
    opts: { narrow: true, dark: true, longText: true, banner: false, lineShift: 3, rows: ["Zephyr Ltd", ...BASE_ROWS.filter((r) => r !== "Bluebird LLC")] },
  },
]

// Held out: written after v2 was tuned, aimed at the evidence v2 leans on.
// Content is the load-bearing signal, so these attack the content.
export const ADVERSARIAL: Scenario[] = [
  { id: "adv-duplicate-grid", klass: "adversarial", detail: "an identical second card grid on the page", opts: { duplicateGrid: true } },
  { id: "adv-button-relabel", klass: "adversarial", detail: "every card button relabelled Manage → Configure", opts: { buttonLabel: "Configure" } },
  { id: "adv-cards-rewritten", klass: "adversarial", detail: "all card copy rewritten: context signal destroyed", opts: { relabelCards: true } },
  { id: "adv-row-renamed", klass: "adversarial", detail: "the target row renamed Cinder Co → Cinder Holdings", opts: { renameRow: { from: "Cinder Co", to: "Cinder Holdings" } } },
  { id: "adv-total-rewrite", klass: "adversarial", detail: "cards rewritten + buttons relabelled + row renamed + lines +3", opts: { relabelCards: true, buttonLabel: "Configure", renameRow: { from: "Cinder Co", to: "Cinder Holdings" }, lineShift: 3 } },
  { id: "adv-clone-and-churn", klass: "adversarial", detail: "duplicate grid + narrow + banner gone + lines +3", env: { hostWidth: "420px" }, opts: { duplicateGrid: true, narrow: true, banner: false, lineShift: 3 } },
]

export const ALL_SCENARIOS: Scenario[] = [...SCENARIOS, ...ADVERSARIAL]

export type Outcome = "correct" | "orphaned" | "wrong"

export interface Cell {
  scenario: string
  klass: Scenario["klass"]
  target: string
  strategy: string
  outcome: Outcome
  /** truth-id of whatever the strategy returned, when it was wrong. */
  landedOn?: string
}

export interface LabResult {
  cells: Cell[]
  byStrategy: Record<string, { correct: number; orphaned: number; wrong: number; total: number }>
  /** How far the stored absolute point drifts from the element-relative one. */
  drift: { mean: number; max: number; samples: number }
  anchors: Record<string, Anchor>
}

function frame(): Promise<void> {
  return new Promise((r) => requestAnimationFrame(() => r()))
}

function applyEnv(host: HTMLElement, env?: Env): void {
  document.documentElement.style.fontSize = env?.fontScale ? `${16 * env.fontScale}px` : ""
  host.style.width = env?.hostWidth ?? ""
  window.scrollTo(0, env?.scrollY ?? 0)
}

/** The point inside a target we pretend the human clicked. */
function clickPoint(el: Element): { x: number; y: number } {
  const r = el.getBoundingClientRect()
  return { x: r.left + r.width * 0.3, y: r.top + r.height * 0.6 }
}

export async function runLab(host: HTMLElement): Promise<LabResult> {
  // 1. Capture on the baseline.
  applyEnv(host)
  renderPage(host, BASELINE)
  await frame()

  const anchors: Record<string, Anchor> = {}
  for (const t of TARGETS) {
    const el = host.querySelector(`[data-truth-id="${t.truth}"]`)
    if (!el) throw new Error(`baseline is missing target ${t.truth}`)
    const p = clickPoint(el)
    anchors[t.truth] = captureAnchor(el, p.x, p.y, host)
  }

  const cells: Cell[] = []
  const drifts: number[] = []

  // 2. Mutate and re-resolve.
  for (const s of ALL_SCENARIOS) {
    const opts: SpecOpts = { ...BASELINE, ...s.opts }
    applyEnv(host, s.env)
    renderPage(host, opts)
    await frame()

    for (const t of TARGETS) {
      const anchor = anchors[t.truth]
      const truth = host.querySelector(`[data-truth-id="${t.truth}"]`)

      if (truth) {
        // How far the stored absolute point now sits from the element-relative
        // point. This is the placement half of the problem, measured directly.
        const now = pinPoint(truth, anchor)
        drifts.push(Math.hypot(now.x - anchor.pageCoords.x, now.y - anchor.pageCoords.y))
      }

      for (const st of STRATEGIES) {
        let got: Element | null = null
        try {
          got = st.fn(anchor, host)
        } catch {
          got = null
        }
        let outcome: Outcome
        let landedOn: string | undefined
        if (!truth) {
          outcome = got ? "wrong" : "correct"
        } else if (got === truth) {
          outcome = "correct"
        } else if (!got) {
          outcome = "orphaned"
        } else {
          outcome = "wrong"
        }
        if (outcome === "wrong" && got) {
          landedOn = got.getAttribute("data-truth-id") ?? `<${got.tagName.toLowerCase()}>`
        }
        cells.push({ scenario: s.id, klass: s.klass, target: t.truth, strategy: st.id, outcome, landedOn })
      }
    }
  }

  // 3. Restore.
  applyEnv(host)
  renderPage(host, BASELINE)
  await frame()

  const byStrategy: LabResult["byStrategy"] = {}
  for (const st of STRATEGIES) byStrategy[st.id] = { correct: 0, orphaned: 0, wrong: 0, total: 0 }
  for (const c of cells) {
    byStrategy[c.strategy][c.outcome]++
    byStrategy[c.strategy].total++
  }

  return {
    cells,
    byStrategy,
    drift: {
      mean: drifts.length ? drifts.reduce((a, b) => a + b, 0) / drifts.length : 0,
      max: drifts.length ? Math.max(...drifts) : 0,
      samples: drifts.length,
    },
    anchors,
  }
}
