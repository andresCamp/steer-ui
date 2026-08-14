import { For, mergeProps, type JSX } from "solid-js"

export interface RegionProps {
  /** Region is selected / its pin is open. */
  open?: boolean
  /** Note mode: the region ignores pointer events. */
  inert?: boolean
  onPointerDown?: (e: PointerEvent) => void
  onResize?: (cornerX: 0 | 1, cornerY: 0 | 1, e: PointerEvent) => void
  children?: JSX.Element
}

const CORNERS: { cx: 0 | 1; cy: 0 | 1; pos: string; cursor: string }[] = [
  { cx: 0, cy: 0, pos: "left-0 top-0", cursor: "cursor-nwse-resize" },
  { cx: 1, cy: 0, pos: "right-0 top-0", cursor: "cursor-nesw-resize" },
  { cx: 0, cy: 1, pos: "left-0 bottom-0", cursor: "cursor-nesw-resize" },
  { cx: 1, cy: 1, pos: "right-0 bottom-0", cursor: "cursor-nwse-resize" },
]

/** Highlight box for a region note. Quiet until open; corners resize. */
export function Region(props: RegionProps) {
  const p = mergeProps({ open: false, inert: false }, props)
  return (
    <div
      class={`group/region relative h-full min-h-24 min-w-40 rounded-md border-2 transition-colors duration-200 ${
        p.inert ? "pointer-events-none" : "cursor-grab active:cursor-grabbing"
      } ${
        p.open
          ? "border-amber-400/80 bg-amber-400/10"
          : "border-amber-400/25 bg-amber-400/[0.04] hover:border-amber-400/50"
      }`}
      onPointerDown={(e) => p.onPointerDown?.(e)}
    >
      <For each={CORNERS}>
        {(corner) => (
          <div
            class={`absolute size-4 ${corner.pos} ${corner.cursor} ${
              corner.cx === 0 ? "-translate-x-1/2" : "translate-x-1/2"
            } ${corner.cy === 0 ? "-translate-y-1/2" : "translate-y-1/2"} flex items-center justify-center opacity-0 transition-opacity duration-150 group-hover/region:opacity-100`}
            onPointerDown={(e) => p.onResize?.(corner.cx, corner.cy, e)}
          >
            <div class="size-2.5 rounded-full border-2 border-amber-400 bg-white shadow-sm" />
          </div>
        )}
      </For>
      {p.children}
    </div>
  )
}
