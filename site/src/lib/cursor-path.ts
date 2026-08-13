/**
 * Human-ish cursor motion.
 *
 * Three things separate a real hand from a linear tween, and all three come
 * from the ghost-cursor approach: the path bends along a cubic bezier whose
 * control points sit on ONE side of the direct line (both sides gives a wonky
 * S no hand ever makes), the duration follows Fitts's law so far or small
 * targets take longer, and long throws overshoot slightly and correct back.
 */

export interface Point {
  x: number
  y: number
}

function cubic(p0: Point, c1: Point, c2: Point, p3: Point, t: number): Point {
  const u = 1 - t
  const a = u * u * u
  const b = 3 * u * u * t
  const c = 3 * u * t * t
  const d = t * t * t
  return {
    x: a * p0.x + b * c1.x + c * c2.x + d * p3.x,
    y: a * p0.y + b * c1.y + c * c2.y + d * p3.y,
  }
}

/** Control points offset perpendicular to the line, both on the same side. */
export function arc(from: Point, to: Point, side: number, bend = 1): [Point, Point] {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const distance = Math.hypot(dx, dy) || 1
  const px = -dy / distance
  const py = dx / distance
  const spread = Math.min(distance * 0.28, 130) * bend * side
  return [
    { x: from.x + dx * 0.35 + px * spread * 0.8, y: from.y + dy * 0.35 + py * spread * 0.8 },
    { x: from.x + dx * 0.68 + px * spread, y: from.y + dy * 0.68 + py * spread },
  ]
}

/** Fitts's law: time grows with distance and shrinks with target size. */
export function fitts(distance: number, targetWidth: number): number {
  const index = Math.log2((2 * distance) / Math.max(targetWidth, 20) + 1)
  return Math.min(1250, Math.max(260, 170 + 150 * index))
}

/** Slow at both ends, quick through the middle. */
export function easeInOut(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

/** A hand throwing the cursor a long way lands past the target, then corrects. */
export const OVERSHOOT_THRESHOLD = 420

export function overshootPoint(from: Point, to: Point): Point {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const distance = Math.hypot(dx, dy) || 1
  const past = Math.min(distance * 0.07, 46)
  return { x: to.x + (dx / distance) * past, y: to.y + (dy / distance) * past }
}

export interface Animator {
  (from: Point, to: Point, ms: number, side: number, onFrame: (p: Point) => void): Promise<void>
}

/** Walk the bezier over `ms`, reporting every frame. */
export const glide: Animator = (from, to, ms, side, onFrame) =>
  new Promise((resolve) => {
    const [c1, c2] = arc(from, to, side)
    const start = performance.now()
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / ms)
      onFrame(cubic(from, c1, c2, to, easeInOut(t)))
      if (t < 1) requestAnimationFrame(step)
      else resolve()
    }
    requestAnimationFrame(step)
  })

/**
 * A drag is not a move. Pulling a selection box, a hand runs straight from
 * corner to corner: any bend would make the box grow and shrink as the cursor
 * swings off the line and back. Straight, eased at both ends, no overshoot.
 */
export const drag = (from: Point, to: Point, ms: number, onFrame: (p: Point) => void): Promise<void> =>
  new Promise((resolve) => {
    const start = performance.now()
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / ms)
      const e = easeInOut(t)
      onFrame({ x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e })
      if (t < 1) requestAnimationFrame(step)
      else resolve()
    }
    requestAnimationFrame(step)
  })

/** Dragging is more deliberate than moving: slower, and scaled to the pull. */
export const dragDuration = (distance: number): number =>
  Math.min(1000, Math.max(560, distance * 2.1))
