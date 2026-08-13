import { Show } from "solid-js"

export interface DemoCursorProps {
  x: number
  y: number
  visible?: boolean
  /** Pressed: the arrow tucks in, the way a real click reads. */
  pressed?: boolean
}

/** The pointer that performs the loop. Never receives events. */
export function DemoCursor(props: DemoCursorProps) {
  return (
    <Show when={props.visible !== false}>
      <div
        class="pointer-events-none fixed z-50"
        style={{
          left: `${props.x}px`,
          top: `${props.y}px`,
          transform: `translate(-3px, -2px) scale(${props.pressed ? 0.86 : 1})`,
          transition: "transform 110ms cubic-bezier(0.22, 1, 0.36, 1)",
          "will-change": "left, top",
        }}
      >
        <svg width="22" height="26" viewBox="0 0 22 26" fill="none">
          <path
            d="M4 2.2 L4 20.4 L8.7 16.1 L11.6 22.6 L14.9 21.1 L12 14.8 L18.2 14.4 Z"
            fill="#18181b"
            stroke="#ffffff"
            stroke-width="1.6"
            stroke-linejoin="round"
          />
        </svg>
        <span
          class="absolute left-1/2 top-1/2 -z-10 block size-9 -translate-x-1/2 -translate-y-1/2 rounded-full bg-zinc-900/10 transition-transform duration-150"
          style={{ transform: `translate(-50%, -50%) scale(${props.pressed ? 1 : 0})` }}
        />
      </div>
    </Show>
  )
}
