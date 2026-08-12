// The specimen: a realistic host page, rendered from a spec so mutations are
// declarative and repeatable.
//
// Two attribute families, and the distinction matters:
//   data-steer-loc   what the proposed dev transform emits. Strategies may read it.
//   data-truth-id    harness-only identity. No strategy reads it, so scoring is
//                    objective rather than self-confirming.
//
// Card internals deliberately share one source loc across all three cards, and
// list rows share one loc across all rows: that is what a .map() over a single
// JSX line actually produces, and it is the case that breaks naive matching.

export interface SpecOpts {
  narrow: boolean
  dark: boolean
  longText: boolean
  /** A dismissible banner above the fold; its presence shifts everything below. */
  banner: boolean
  rows: string[]
  /** Extra <div> around the card grid — breaks structural paths. */
  wrapGrid: boolean
  /** Strip id attributes — breaks the stable-selector layer. */
  dropIds: boolean
  /** Simulates an edit above these elements: every loc line moves. */
  lineShift: number
  /** Simulates a reformat: columns move, lines do not. */
  colShift: number
  /** Simulates the component moving to another directory. */
  fileMove: boolean
  /** truth-ids to omit entirely. */
  removed: string[]
  /** A second, identical card grid — genuine ambiguity with no truth marks. */
  duplicateGrid: boolean
  /** Rewrite every card's copy: destroys the surrounding-context signal. */
  relabelCards: boolean
  /** The label shared by all three card buttons. */
  buttonLabel: string
  /** Rename a row's display text while keeping its identity. */
  renameRow?: { from: string; to: string }
}

export const BASE_ROWS = ["Acme Corp", "Bluebird LLC", "Cinder Co", "Dovetail Inc", "Everest Ltd"]

export const BASELINE: SpecOpts = {
  narrow: false,
  dark: false,
  longText: false,
  banner: true,
  rows: BASE_ROWS,
  wrapGrid: false,
  dropIds: false,
  lineShift: 0,
  colShift: 0,
  fileMove: false,
  removed: [],
  duplicateGrid: false,
  relabelCards: false,
  buttonLabel: "Manage",
}

const FILES = {
  billing: "src/pages/Billing.tsx",
  card: "src/components/Card.tsx",
} as const

type FileKey = keyof typeof FILES

interface ElOpts {
  file?: FileKey
  line?: number
  col?: number
  truth?: string
  id?: string
  testid?: string
  cls?: string
  text?: string
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
}

export function renderPage(host: Element, o: SpecOpts): void {
  const path = (f: FileKey) =>
    o.fileMove && f === "card" ? "src/ui/primitives/Card.tsx" : FILES[f]

  function el(tag: string, opts: ElOpts, kids: (Node | string)[] = []): HTMLElement {
    const n = document.createElement(tag)
    if (opts.file && opts.line != null) {
      n.setAttribute(
        "data-steer-loc",
        `${path(opts.file)}:${opts.line + o.lineShift}:${(opts.col ?? 2) + o.colShift}`,
      )
    }
    if (opts.truth) n.setAttribute("data-truth-id", opts.truth)
    if (opts.id && !o.dropIds) n.id = opts.id
    if (opts.testid) n.setAttribute("data-testid", opts.testid)
    if (opts.cls) n.className = opts.cls
    if (opts.text) n.append(document.createTextNode(opts.text))
    for (const k of kids) n.append(k)
    return n
  }

  const long = o.longText
    ? " Extended copy that changes the wrapping and the height of this element considerably."
    : ""

  // --- the card component: three instances, all sharing its internal locs ----
  const cardCopy = o.relabelCards
    ? [
        { truth: "card1", title: "Solo", body: "One workspace, one seat, nothing else." },
        { truth: "card2", title: "Studio", body: "Shared review, pooled fixtures, up to 25." },
        { truth: "card3", title: "Estate", body: "Directory sync, retention policy, exports." },
      ]
    : [
        { truth: "card1", title: "Starter", body: "Up to 3 seats and the core workspace." },
        { truth: "card2", title: "Team", body: "Up to 25 seats, shared fixtures, review queue." },
        { truth: "card3", title: "Enterprise", body: "Unlimited seats, SSO, audit export." },
      ]
  const cards = cardCopy.map((c) =>
    el("article", { file: "card", line: 8, col: 4, truth: c.truth, cls: "card" }, [
      el("h3", { file: "card", line: 10, col: 6, truth: `${c.truth}-title`, text: c.title }),
      el("p", {
        file: "card",
        line: 12,
        col: 6,
        truth: `${c.truth}-body`,
        cls: "card-body",
        text: c.body + long,
      }),
      el("div", { file: "card", line: 15, col: 6, cls: "card-actions" }, [
        // Same loc, same text, same structure in all three cards. The nastiest case.
        el("button", {
          file: "card",
          line: 16,
          col: 8,
          truth: `${c.truth}-action`,
          cls: "btn",
          text: o.buttonLabel,
        }),
      ]),
    ]),
  )

  const grid = el("div", { file: "billing", line: 31, col: 4, cls: "grid" }, cards)
  let gridHolder: HTMLElement = o.wrapGrid ? el("div", { cls: "grid-wrap" }, [grid]) : grid
  if (o.duplicateGrid) {
    // A byte-identical second grid, stripped of truth marks: if a resolver
    // picks out of the clone it has genuinely lost the note.
    const clone = grid.cloneNode(true) as HTMLElement
    for (const n of Array.from(clone.querySelectorAll("[data-truth-id]"))) {
      n.removeAttribute("data-truth-id")
    }
    gridHolder = el("div", { cls: "grid-stack" }, [gridHolder, clone])
  }

  const nav = el(
    "nav",
    { file: "billing", line: 16, col: 4, cls: "nav" },
    ["Overview", "Usage", "Billing", "Team"].map((label) =>
      el("a", {
        file: "billing",
        line: 17,
        col: 6,
        truth: `nav-${slug(label)}`,
        id: `nav-${slug(label)}`,
        cls: "nav-link",
        text: label,
      }),
    ),
  )

  const rows = el(
    "div",
    { file: "billing", line: 40, col: 4, cls: "rows" },
    o.rows.map((name) => {
      const shown = o.renameRow && o.renameRow.from === name ? o.renameRow.to : name
      return el("div", { file: "billing", line: 41, col: 6, truth: `row-${slug(name)}`, cls: "row" }, [
        el("span", { cls: "row-name", text: shown }),
        el("span", { cls: "row-amt", text: "$1,240.00" }),
      ])
    }),
  )

  const kids: Node[] = [
    el("header", { file: "billing", line: 12, col: 4, cls: "hdr" }, [
      el("h1", {
        file: "billing",
        line: 13,
        col: 6,
        truth: "title",
        id: "page-title",
        text: "Billing",
      }),
      nav,
    ]),
  ]

  if (o.banner) {
    kids.push(
      el("div", { file: "billing", line: 24, col: 4, truth: "banner", cls: "banner" }, [
        el("span", { file: "billing", line: 25, col: 6, text: "Your trial ends in 4 days." }),
        el("button", {
          file: "billing",
          line: 26,
          col: 6,
          truth: "banner-cta",
          cls: "btn btn-primary",
          text: "Upgrade now",
        }),
      ]),
    )
  }

  kids.push(gridHolder, rows)

  kids.push(
    el("form", { file: "billing", line: 52, col: 4, cls: "form" }, [
      el("input", {
        file: "billing",
        line: 53,
        col: 6,
        truth: "field-email",
        testid: "billing-email",
        cls: "input",
      }),
      el("input", { file: "billing", line: 54, col: 6, truth: "field-name", cls: "input" }),
    ]),
  )

  kids.push(
    el("footer", { file: "billing", line: 60, col: 4, cls: "ftr" }, [
      el("p", {
        file: "billing",
        line: 61,
        col: 6,
        truth: "footer-note",
        text: "Invoices are issued on the first of each month." + long,
      }),
    ]),
  )

  host.replaceChildren(...kids)
  // Elements the scenario says are genuinely gone. The only honest answer for a
  // note anchored to one of these is "orphaned".
  for (const t of o.removed) host.querySelector(`[data-truth-id="${t}"]`)?.remove()
  host.classList.toggle("narrow", o.narrow)
  host.classList.toggle("dark", o.dark)
}

/** The eight notes we place, chosen to cover every failure mode at least once. */
export const TARGETS = [
  { truth: "title", why: "has an id, top of page" },
  { truth: "nav-billing", why: "has an id, sibling among identical links" },
  { truth: "card2-action", why: "loc + text + structure identical to two siblings" },
  { truth: "row-cinder-co", why: "one source line, five DOM rows" },
  { truth: "banner-cta", why: "lives inside conditional content" },
  { truth: "field-email", why: "data-testid, no id, void element" },
  { truth: "card3-body", why: "deep, no id, no testid, shared loc" },
  { truth: "footer-note", why: "plain text, below everything that shifts" },
] as const
