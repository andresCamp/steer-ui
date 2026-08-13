// The anchoring question, isolated from everything else.
//
// A page note is captured against one element and must be found again after the
// page changes. This file is the thing under test: how an anchor is captured,
// and the competing strategies for resolving it later.
//
// Two problems hide inside "does the note survive":
//   1. Re-identification — which element is this note about?
//   2. Placement — where the pin draws once that element is found.
// They fail for different reasons and are scored separately by the harness.

export interface SourceLoc {
  file: string
  line: number
  col: number
}

/** Everything written at capture time. Resolution reads; it never re-captures. */
export interface Anchor {
  /** From data-steer-loc, as the proposed dev transform would emit it. */
  source?: SourceLoc
  /** Index among elements sharing that exact loc (one source line, N rows). */
  occurrence: number
  /** How many elements shared that loc at capture time. If the count has
   *  changed, the set changed, and `occurrence` can no longer be trusted. */
  siblingCount: number
  /** Position within the parent's children. Structure, not content. */
  childIndex: number
  /** #id or [data-testid] when the element carries one. */
  stableSelector?: string
  /** Structural nth-of-type path from the root. */
  path: string
  /** Lowercase tag name. */
  tag: string
  /** Tag + child tag sequence + leading text. Survives attribute churn. */
  fingerprint: string
  /** Collapsed text, capped. */
  text: string
  /** Text of the nearest ancestor that differs from `text`. */
  context: string
  /** Fractions of the element's own border box. May fall outside 0..1 when
   *  the note sits in a gutter, which SteerNote already allows. */
  elCoords: { x: number; y: number }
  /** True when the anchor element was reached by walking up from whitespace
   *  rather than being clicked directly. */
  viaAncestor: boolean
  /** Absolute document coordinates at capture time. */
  pageCoords: { x: number; y: number }
  /** Reproduction context, per BugHerd/Marker's lesson. */
  viewport: { w: number; h: number }
}

const TEXT_CAP = 60
const CTX_CAP = 90

function collapse(s: string, cap = TEXT_CAP): string {
  return s.replace(/\s+/g, " ").trim().slice(0, cap)
}

/**
 * Text of the nearest ancestor that says something the element does not.
 * Three identical "Manage" buttons are only told apart by the card around
 * them; this is that signal, and the experiment showed it is decisive.
 */
export function ancestorContext(el: Element, root: Element): string {
  const own = collapse(el.textContent ?? "")
  let cur: Element | null = el.parentElement
  let hops = 0
  while (cur && cur !== root && hops < 4) {
    const t = collapse(cur.textContent ?? "", CTX_CAP)
    if (t && t !== own) return t
    cur = cur.parentElement
    hops++
  }
  return ""
}

function parseLoc(raw: string | null): SourceLoc | undefined {
  if (!raw) return undefined
  // file:line:col, where file may itself contain colons on Windows-y paths.
  const m = /^(.*):(\d+):(\d+)$/.exec(raw)
  if (!m) return undefined
  return { file: m[1], line: Number(m[2]), col: Number(m[3]) }
}

function locString(loc: SourceLoc): string {
  return `${loc.file}:${loc.line}:${loc.col}`
}

export function childIndexOf(el: Element): number {
  const p = el.parentElement
  return p ? Array.from(p.children).indexOf(el) : -1
}

export function fingerprintOf(el: Element): string {
  const kids = Array.from(el.children)
    .map((c) => c.tagName.toLowerCase())
    .join(",")
  return `${el.tagName.toLowerCase()}[${kids}]{${collapse(el.textContent ?? "")}}`
}

export function cssPath(el: Element, root: Element): string {
  if (el === root) return ":scope"
  const parts: string[] = []
  let cur: Element | null = el
  while (cur && cur !== root) {
    const self: Element = cur
    const parent: HTMLElement | null = self.parentElement
    if (!parent) break
    const tag = self.tagName.toLowerCase()
    const sibs = Array.from(parent.children).filter((c) => c.tagName === self.tagName)
    parts.unshift(sibs.length > 1 ? `${tag}:nth-of-type(${sibs.indexOf(self) + 1})` : tag)
    cur = parent
  }
  return `:scope > ${parts.join(" > ")}`
}

function stableSelectorOf(el: Element): string | undefined {
  const id = el.getAttribute("id")
  if (id) return `#${CSS.escape(id)}`
  const tid = el.getAttribute("data-testid")
  if (tid) return `[data-testid="${CSS.escape(tid)}"]`
  return undefined
}

export interface Box {
  left: number
  top: number
  width: number
  height: number
}

/**
 * The deepest element whose box fully contains `box`. A region drawn across two
 * cards resolves to the grid holding them; a region inside one card resolves to
 * the card. This is what a region anchors to.
 */
export function deepestContaining(root: Element, box: Box): Element {
  const right = box.left + box.width
  const bottom = box.top + box.height
  let best: Element = root
  let bestArea = Infinity
  let bestLoc: Element | null = null
  let bestLocArea = Infinity
  for (const el of [root, ...Array.from(root.querySelectorAll("*"))]) {
    const b = el.getBoundingClientRect()
    if (!b.width || !b.height) continue
    if (b.left > box.left || b.top > box.top || b.right < right || b.bottom < bottom) continue
    const area = b.width * b.height
    if (area < bestArea) {
      bestArea = area
      best = el
    }
    if (el.hasAttribute("data-steer-loc") && area < bestLocArea) {
      bestLocArea = area
      bestLoc = el
    }
  }
  // An element with a loc is identifiable across source edits; one without is
  // only findable structurally. Prefer the former even when it is larger.
  return bestLoc ?? best
}

/**
 * A click on whitespace lands on a padding box or a bare wrapper. Walk up to
 * something the resolver can actually identify, and record that we did.
 */
export function nearestAnchorable(el: Element, root: Element): { el: Element; viaAncestor: boolean } {
  let cur: Element | null = el
  let hops = 0
  while (cur && cur !== root) {
    if (cur.hasAttribute("data-steer-loc")) return { el: cur, viaAncestor: hops > 0 }
    cur = cur.parentElement
    hops++
  }
  return { el: root, viaAncestor: true }
}

/** Capture an anchor for `el` at a viewport point, optionally with a region. */
export function captureAnchor(
  el: Element,
  clientX: number,
  clientY: number,
  root: Element,
  viaAncestor = false,
): Anchor {
  const raw = el.getAttribute("data-steer-loc")
  const source = parseLoc(raw)
  let occurrence = 0
  let siblingCount = 1
  if (raw) {
    const sharing = Array.from(root.querySelectorAll(`[data-steer-loc="${CSS.escape(raw)}"]`))
    occurrence = Math.max(0, sharing.indexOf(el))
    siblingCount = sharing.length
  }
  const r = el.getBoundingClientRect()
  return {
    source,
    occurrence,
    siblingCount,
    childIndex: childIndexOf(el),
    stableSelector: stableSelectorOf(el),
    path: cssPath(el, root),
    tag: el.tagName.toLowerCase(),
    fingerprint: fingerprintOf(el),
    text: collapse(el.textContent ?? ""),
    context: ancestorContext(el, root),
    viaAncestor,
    elCoords: {
      x: r.width ? (clientX - r.left) / r.width : 0.5,
      y: r.height ? (clientY - r.top) / r.height : 0.5,
    },
    pageCoords: { x: clientX + window.scrollX, y: clientY + window.scrollY },
    viewport: { w: window.innerWidth, h: window.innerHeight },
  }
}

// ---------------------------------------------------------------- strategies

export type Strategy = (a: Anchor, root: Element) => Element | null

/** Deepest element in `root` whose box contains the stored document point. */
export const byPageCoords: Strategy = (a, root) => {
  const x = a.pageCoords.x - window.scrollX
  const y = a.pageCoords.y - window.scrollY
  let best: Element | null = null
  let bestArea = Infinity
  for (const el of Array.from(root.querySelectorAll("*"))) {
    const r = el.getBoundingClientRect()
    if (!r.width || !r.height) continue
    if (x < r.left || x > r.right || y < r.top || y > r.bottom) continue
    const area = r.width * r.height
    if (area < bestArea) {
      bestArea = area
      best = el
    }
  }
  return best
}

export const byPath: Strategy = (a, root) => {
  if (a.path === ":scope") return root
  try {
    return root.querySelector(a.path)
  } catch {
    return null
  }
}

export const byStableSelector: Strategy = (a, root) => {
  if (!a.stableSelector) return byPath(a, root)
  try {
    if (root.matches(a.stableSelector)) return root
    return root.querySelector(a.stableSelector) ?? null
  } catch {
    return null
  }
}

/** Exact loc match, disambiguated by the recorded occurrence index. */
export const bySourceExact: Strategy = (a, root) => {
  if (!a.source) return null
  const sel = `[data-steer-loc="${CSS.escape(locString(a.source))}"]`
  const hits = Array.from(root.querySelectorAll(sel))
  if (!hits.length) return null
  return hits[Math.min(a.occurrence, hits.length - 1)] ?? null
}

function bigrams(s: string): Set<string> {
  const out = new Set<string>()
  for (let i = 0; i < s.length - 1; i++) out.add(s.slice(i, i + 2))
  return out
}

/** Sorensen-Dice over character bigrams. 1 = identical, 0 = nothing shared. */
export function similarity(a: string, b: string): number {
  if (a === b) return 1
  if (!a.length || !b.length) return 0
  const A = bigrams(a)
  const B = bigrams(b)
  let shared = 0
  for (const g of A) if (B.has(g)) shared++
  return (2 * shared) / (A.size + B.size)
}

const FUZZY_THRESHOLD = 120

/**
 * Source-first, but tolerant. Line numbers shift the moment anyone edits above
 * the element, so exact matching is not enough; score candidates on file, line
 * proximity, tag, text and structure, and refuse to answer below a threshold.
 * The threshold is the whole point: a confident wrong answer is worse than an
 * honest orphan (invariant 4).
 */
export const bySourceFuzzy: Strategy = (a, root) => {
  if (!a.source) return null
  const want = a.source
  const wantBase = want.file.split("/").pop() ?? want.file
  const cands = Array.from(root.querySelectorAll("[data-steer-loc]"))
  let best: Element | null = null
  let bestScore = -Infinity
  let bestTie = -Infinity

  for (const el of cands) {
    const loc = parseLoc(el.getAttribute("data-steer-loc"))
    if (!loc) continue
    let score = 0
    if (loc.file === want.file) score += 100
    else if ((loc.file.split("/").pop() ?? loc.file) === wantBase) score += 55
    else continue

    const dLine = Math.abs(loc.line - want.line)
    score += dLine === 0 ? 60 : Math.max(0, 45 - dLine * 3)
    if (loc.col === want.col) score += 12

    if (el.tagName.toLowerCase() === a.tag) score += 25

    const textSim = similarity(collapse(el.textContent ?? ""), a.text)
    score += 40 * textSim
    if (fingerprintOf(el) === a.fingerprint) score += 20

    const sel = stableSelectorOf(el)
    if (sel && a.stableSelector && sel === a.stableSelector) score += 30

    // Occurrence breaks ties between siblings that genuinely share a loc.
    const tie = textSim
    if (score > bestScore || (score === bestScore && tie > bestTie)) {
      bestScore = score
      bestTie = tie
      best = el
    }
  }
  return bestScore >= FUZZY_THRESHOLD ? best : null
}

/**
 * The proposed production resolver. Source first because it is the only layer
 * that knows what the element *is* rather than where it sat; DOM layers below
 * it; an honest null at the bottom.
 */
export const layered: Strategy = (a, root) => {
  const exact = bySourceExact(a, root)
  if (exact && similarity(collapse(exact.textContent ?? ""), a.text) > 0.45) return exact
  const fuzzy = bySourceFuzzy(a, root)
  if (fuzzy) return fuzzy
  if (a.stableSelector) {
    const stable = byStableSelector(a, root)
    if (stable) return stable
  }
  const path = byPath(a, root)
  if (path && similarity(collapse(path.textContent ?? ""), a.text) > 0.6) return path
  return null
}

// ------------------------------------------------------------- layered v2
//
// v1 lost to a plain nth-of-type path, for two reasons the lab made obvious:
//   - it never refused to answer, so every deleted element produced a
//     confident wrong match;
//   - it scored source location so heavily that three buttons sharing one
//     source line and one label were indistinguishable.
//
// v2 inverts the weighting. Source narrows the candidate set to a file and
// gives the tiebreak; *content* decides, and content also gates: below the
// floors the resolver returns null and the note shows as orphaned.

const TEXT_FLOOR = 0.72
const CONTEXT_FLOOR = 0.55

function basename(p: string): string {
  return p.split("/").pop() ?? p
}

/** Used when there is no usable source evidence at all. */
function domFallback(a: Anchor, root: Element): Element | null {
  if (a.path === ":scope") return root
  if (a.stableSelector) {
    if (root.matches(a.stableSelector)) return root
    const el = root.querySelector(a.stableSelector)
    if (el) return el
  }
  const p = byPath(a, root)
  if (!p) return null
  if (!a.text) return p
  return similarity(collapse(p.textContent ?? ""), a.text) >= TEXT_FLOOR ? p : null
}

/**
 * Content is the wrong signal for an element that holds live data: a KPI whose
 * value goes from $412,880 to $438,110 is the same element, not a new one, and
 * a dashboard is mostly such elements. So when content evidence fails, fall
 * back to pure structure.
 *
 * The guard is `siblingCount`. Occurrence is only meaningful while the set it
 * indexes into is intact; if a row was added or a card deleted, the count has
 * moved and this tier declines rather than guessing. Uniqueness is required
 * too: exactly one group in the file may match on size, tag and child index.
 */
function byStructure(a: Anchor, root: Element): Element | null {
  if (!a.source || a.siblingCount < 1) return null
  const wantBase = basename(a.source.file)
  const groups = new Map<string, Element[]>()

  for (const el of Array.from(root.querySelectorAll("[data-steer-loc]"))) {
    const loc = parseLoc(el.getAttribute("data-steer-loc"))
    if (!loc) continue
    if (loc.file !== a.source.file && basename(loc.file) !== wantBase) continue
    const k = locString(loc)
    const g = groups.get(k)
    if (g) g.push(el)
    else groups.set(k, [el])
  }

  const viable: Element[] = []
  for (const g of groups.values()) {
    if (g.length !== a.siblingCount) continue
    const cand = g[a.occurrence]
    if (!cand) continue
    if (cand.tagName.toLowerCase() !== a.tag) continue
    if (childIndexOf(cand) !== a.childIndex) continue
    viable.push(cand)
  }
  return viable.length === 1 ? viable[0] : null
}

export const layeredV2: Strategy = (a, root) => {
  if (!a.source) return domFallback(a, root)
  const want = a.source
  const wantBase = basename(want.file)
  const emptyText = a.text === ""

  const seen = new Map<string, number>()
  const cands: { el: Element; textSim: number; ctxSim: number; score: number; sameTag: boolean }[] =
    []

  for (const el of Array.from(root.querySelectorAll("[data-steer-loc]"))) {
    const loc = parseLoc(el.getAttribute("data-steer-loc"))
    if (!loc) continue
    const sameFile = loc.file === want.file
    // Basename match carries a file move; the line number carries nothing,
    // which the source-* scenarios demonstrated conclusively.
    if (!sameFile && basename(loc.file) !== wantBase) continue

    const key = locString(loc)
    const idx = seen.get(key) ?? 0
    seen.set(key, idx + 1)

    const sel = stableSelectorOf(el)
    const selMatch = !!a.stableSelector && sel === a.stableSelector

    // An element with no text (an input, an icon) offers no content evidence.
    // Rather than let it match anything, demand a stable selector or step out
    // to the structural fallback.
    if (emptyText && !selMatch) continue

    const textSim = emptyText ? 1 : similarity(collapse(el.textContent ?? ""), a.text)
    const ctxSim = a.context ? similarity(ancestorContext(el, root), a.context) : 0

    const sameTag = el.tagName.toLowerCase() === a.tag
    let score = 60 * textSim + 25 * ctxSim
    if (sameTag) score += 10
    if (sameFile) score += 8
    if (selMatch) score += 15
    if (fingerprintOf(el) === a.fingerprint) score += 6
    if (idx === a.occurrence) score += 5
    score += Math.max(0, 6 - Math.abs(loc.line - want.line) * 0.1)

    cands.push({ el, textSim, ctxSim, score, sameTag })
  }

  if (!cands.length) return byStructure(a, root) ?? domFallback(a, root)
  cands.sort((x, y) => y.score - x.score)
  const win = cands[0]

  // Gate 1: the element has to still say roughly what it said.
  if (win.textSim < TEXT_FLOOR) return byStructure(a, root)
  // Gate 2: when several candidates say the same thing, the surroundings have
  // to agree too. This is what turns a deleted element into an honest orphan
  // instead of its nearest lookalike.
  const ambiguous = cands.filter((c) => c.textSim >= 0.95 && c.sameTag).length > 1
  if (ambiguous && win.ctxSim < CONTEXT_FLOOR) return byStructure(a, root)

  return win.el
}

export const STRATEGIES: { id: string; label: string; fn: Strategy }[] = [
  { id: "page-coords", label: "page coords", fn: byPageCoords },
  { id: "path", label: "nth-of-type path", fn: byPath },
  { id: "stable-sel", label: "stable selector", fn: byStableSelector },
  { id: "source-exact", label: "source exact", fn: bySourceExact },
  { id: "source-fuzzy", label: "source fuzzy", fn: bySourceFuzzy },
  { id: "layered", label: "layered v1", fn: layered },
  { id: "layered-v2", label: "layered v2", fn: layeredV2 },
]

/** Where the pin lands now, given a resolved element and the stored fractions. */
export function pinPoint(el: Element, a: Anchor): { x: number; y: number } {
  const r = el.getBoundingClientRect()
  return {
    x: r.left + window.scrollX + a.elCoords.x * r.width,
    y: r.top + window.scrollY + a.elCoords.y * r.height,
  }
}

/** Fractions of an element's box, from a viewport rect. Inverse of boxOf. */
export function fractionsOf(el: Element, box: Box): { x: number; y: number; w: number; h: number } {
  const r = el.getBoundingClientRect()
  return {
    x: r.width ? (box.left - r.left) / r.width : 0,
    y: r.height ? (box.top - r.top) / r.height : 0,
    w: r.width ? box.width / r.width : 0,
    h: r.height ? box.height / r.height : 0,
  }
}

/** Viewport box for a region stored as fractions of the anchor element. */
export function boxOf(el: Element, rect: { x: number; y: number; w: number; h: number }): Box {
  const r = el.getBoundingClientRect()
  return {
    left: r.left + rect.x * r.width,
    top: r.top + rect.y * r.height,
    width: rect.w * r.width,
    height: rect.h * r.height,
  }
}

/** Leaf elements a region covers. Used to measure whether it still covers what
 *  it covered, which is the region equivalent of finding the right element. */
export function covered(root: Element, box: Box): Set<string> {
  const right = box.left + box.width
  const bottom = box.top + box.height
  const out = new Set<string>()
  for (const el of Array.from(root.querySelectorAll("[data-truth-id], [data-demo-id]"))) {
    const b = el.getBoundingClientRect()
    if (!b.width || !b.height) continue
    const overlapW = Math.min(b.right, right) - Math.max(b.left, box.left)
    const overlapH = Math.min(b.bottom, bottom) - Math.max(b.top, box.top)
    if (overlapW <= 0 || overlapH <= 0) continue
    // Count it as covered when most of the element is inside the region.
    if ((overlapW * overlapH) / (b.width * b.height) < 0.6) continue
    const id = el.getAttribute("data-truth-id") ?? el.getAttribute("data-demo-id")
    if (id) out.add(id)
  }
  return out
}


// ------------------------------------------------------------------ regions
//
// Measured on the demo dashboard: a region stored purely as fractions of its
// container held its element every time and still lost half its coverage, both
// on a narrow resize and on a data shuffle. Fractions of a 4-column grid cover
// different tiles once that grid is 2-column.
//
// So a region gets the same treatment points did: remember what it covered,
// not where it sat. The geometric rect stays as the fallback for a region that
// covers nothing identifiable (drawn over whitespace).

export interface RegionAnchor {
  /** Smallest identifiable element fully containing the region. */
  container: Anchor
  /** Fractions of the container's box. Geometric fallback only. */
  rect: { x: number; y: number; w: number; h: number }
  /** The elements the region was drawn over. The durable part. */
  members: Anchor[]
  /** Gap between the drawn box and the union of its members, in px. */
  pad: { l: number; t: number; r: number; b: number }
}

function unionBox(els: Element[]): Box | null {
  if (!els.length) return null
  let left = Infinity
  let top = Infinity
  let right = -Infinity
  let bottom = -Infinity
  for (const el of els) {
    const b = el.getBoundingClientRect()
    left = Math.min(left, b.left)
    top = Math.min(top, b.top)
    right = Math.max(right, b.right)
    bottom = Math.max(bottom, b.bottom)
  }
  return { left, top, width: right - left, height: bottom - top }
}

/** Elements the region is drawn over: mostly inside it, and not containing it. */
function membersIn(root: Element, box: Box): Element[] {
  const right = box.left + box.width
  const bottom = box.top + box.height
  const out: Element[] = []
  for (const el of Array.from(root.querySelectorAll("[data-steer-loc]"))) {
    const b = el.getBoundingClientRect()
    if (!b.width || !b.height) continue
    // Skip anything that wraps the whole region; that is the container's job.
    if (b.left <= box.left && b.top <= box.top && b.right >= right && b.bottom >= bottom) continue
    const ow = Math.min(b.right, right) - Math.max(b.left, box.left)
    const oh = Math.min(b.bottom, bottom) - Math.max(b.top, box.top)
    if (ow <= 0 || oh <= 0) continue
    if ((ow * oh) / (b.width * b.height) < 0.6) continue
    out.push(el)
  }
  // Drop members that merely wrap other members; keep the outermost distinct
  // subtrees so the union is stable rather than double-counted.
  return out.filter((el) => !out.some((other) => other !== el && other.contains(el)))
}

export function captureRegion(root: Element, box: Box): RegionAnchor {
  const container = deepestContaining(root, box)
  const memberEls = membersIn(root, box)
  const u = unionBox(memberEls)
  return {
    container: captureAnchor(container, box.left, box.top, root, true),
    rect: fractionsOf(container, box),
    members: memberEls.map((el) => {
      const b = el.getBoundingClientRect()
      return captureAnchor(el, b.left + b.width / 2, b.top + b.height / 2, root, false)
    }),
    pad: u
      ? {
          l: u.left - box.left,
          t: u.top - box.top,
          r: box.left + box.width - (u.left + u.width),
          b: box.top + box.height - (u.top + u.height),
        }
      : { l: 0, t: 0, r: 0, b: 0 },
  }
}

/** Viewport box for a region: union of whatever members still exist. */
export function resolveRegion(root: Element, r: RegionAnchor): Box | null {
  const found = r.members.map((m) => layeredV2(m, root)).filter((e): e is Element => !!e)
  const u = unionBox(found)
  if (u) {
    return {
      left: u.left - r.pad.l,
      top: u.top - r.pad.t,
      width: u.width + r.pad.l + r.pad.r,
      height: u.height + r.pad.t + r.pad.b,
    }
  }
  const container = layeredV2(r.container, root)
  return container ? boxOf(container, r.rect) : null
}
