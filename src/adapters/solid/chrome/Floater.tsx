import { onCleanup, type JSX } from "solid-js"
import { Portal } from "solid-js/web"
import {
  autoUpdate,
  computePosition,
  flip,
  offset,
  shift,
  size,
  type Padding,
  type Placement,
  type ReferenceElement,
} from "@floating-ui/dom"

/** A live element, or a point in client space. Re-read on every frame. */
export type Anchor = Element | { x: number; y: number }

export interface FloaterProps {
  /** What the panel hangs off. Read each frame, so it is free to move. */
  anchor: () => Anchor | undefined
  /** Preferred side. Flipped away from the edge when it does not fit. */
  placement?: Placement
  /** Gap between the anchor and the panel. */
  gap?: number
  /**
   * Keep-out margins measured in from the viewport edges. This is what
   * "contained inside the page" means here: room reserved for the chrome the
   * panel must never slide under — the knobs panel, the peek bar.
   */
  keepOut?: Padding
  children: JSX.Element
}

const RESET: JSX.CSSProperties = {
  // A popover's UA styles centre it and give it a border; undo all of that.
  position: "fixed",
  inset: "auto",
  margin: "0",
  padding: "0",
  border: "0",
  background: "transparent",
  overflow: "visible",
  width: "max-content",
  "z-index": "2147483647",
  // Revealed by the first solved position, so nothing flashes at the origin.
  visibility: "hidden",
}

/**
 * An anchored panel that cannot be clipped, covered, or pushed off screen.
 *
 * Three problems, three answers, each one load bearing:
 *   - Clipping. The bench draws notes inside a panned, zoomed, overflow-hidden
 *     world, so a panel parented there is cut off at the canvas edge and
 *     scaled by the zoom. Portalling to <body> leaves that space entirely.
 *   - Covering. The overlay injects into somebody else's app, whose z-index
 *     ceiling is unknowable. `popover` promotes the panel into the top layer,
 *     which paints above every stacking context by definition — the honest
 *     version of "highest z".
 *   - Overflow. Position is Floating UI's job: flip to the other side when the
 *     preferred one does not fit, shift along the edge to stay inside, and cap
 *     the size so a long thread scrolls itself instead of escaping the page.
 */
export function Floater(props: FloaterProps) {
  let el: HTMLDivElement | undefined
  let stop: (() => void) | undefined

  /**
   * Anchoring to a point needs a virtual element: the composer hangs off the
   * spot that was clicked, which is not an element at all. Either way the rect
   * is read per frame, so the panel tracks an anchor that moves under it.
   */
  const reference = (): ReferenceElement => ({
    getBoundingClientRect: () => {
      const at = props.anchor()
      if (at instanceof Element) return at.getBoundingClientRect()
      const { x, y } = at ?? { x: 0, y: 0 }
      return { x, y, top: y, left: x, right: x, bottom: y, width: 0, height: 0 }
    },
  })

  const update = () => {
    if (!el || !props.anchor()) return
    const pad = props.keepOut ?? 12
    void computePosition(reference(), el, {
      strategy: "fixed",
      placement: props.placement ?? "top-start",
      middleware: [
        offset(props.gap ?? 12),
        // Edge-aligned placements flip before they shift, per Floating UI's
        // guidance: on a narrow viewport, shifting first strands the panel on
        // the wrong side of its anchor.
        flip({ padding: pad, crossAxis: "alignment", fallbackAxisSideDirection: "end" }),
        shift({ padding: pad }),
        size({
          padding: pad,
          apply({ availableHeight, elements }) {
            const height = Math.max(160, availableHeight)
            Object.assign(elements.floating.style, {
              maxHeight: `${height}px`,
              overflowY: elements.floating.scrollHeight > height ? "auto" : "visible",
            })
          },
        }),
      ],
    }).then(({ x, y }) => {
      if (!el) return
      Object.assign(el.style, { left: `${x}px`, top: `${y}px`, visibility: "visible" })
    })
  }

  const attach = (node: HTMLDivElement) => {
    el = node
    // Manual, not auto: dismissal is ours (Escape, the pin, resolve), and an
    // auto popover would light-dismiss on the very click that opened it.
    node.showPopover?.()
    stop = autoUpdate(reference(), node, update, {
      // The bench anchor moves under a transform, which fires neither scroll
      // nor resize. A frame loop is the only observer that sees that.
      animationFrame: true,
    })
  }

  onCleanup(() => {
    stop?.()
    el?.hidePopover?.()
    el = undefined
  })

  return (
    <Portal mount={document.body}>
      <div
        ref={attach}
        popover="manual"
        style={RESET}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        data-steer-floater
      >
        {props.children}
      </div>
    </Portal>
  )
}
