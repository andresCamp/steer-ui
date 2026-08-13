import { createSignal, onCleanup, onMount, For, Show, type JSX } from "solid-js"
import { MaterialButton } from "../components/MaterialButton"
import { MaterialField } from "../components/MaterialField"
import { AntSegmented } from "../components/AntSegmented"
import { AntSteps } from "../components/AntSteps"
import { ShadcnSwitch } from "../components/ShadcnSwitch"
import { MantineChips } from "../components/MantineChips"
import { HeroSlider } from "../components/HeroSlider"
import { DaisyRating } from "../components/DaisyRating"
import { ChakraAvatarGroup } from "../components/ChakraAvatarGroup"
import { Pin } from "../../../src/adapters/solid/chrome/Pin"
import { NoteThread } from "../../../src/adapters/solid/chrome/NoteThread"

/**
 * One screen of the page's own components, scattered, wearing the product's
 * own pins and note threads.
 *
 * Two rules hold the composition together. Nothing reflows: every tile is
 * absolutely placed and every note hangs off its tile absolutely. And every
 * note keeps its own clock, so they arrive and get answered at different
 * moments rather than in a single synchronised sweep.
 */

interface Specimen {
  id: string
  at: JSX.CSSProperties
  atSm?: JSX.CSSProperties
  side: "left" | "right"
  width: number
  /** When the note lands, when the reply arrives, when the thread closes. */
  noteAt?: number
  replyAt?: number
  closeAt?: number
  note?: string
  reply?: string
  /** Only the widest screens carry the full crowd. */
  small?: boolean
  render: (draft: boolean) => JSX.Element
}

const CYCLE = 22500

/**
 * One note is open at a time. Each takes the floor, gets answered, and closes
 * before the next lands, so the page never reads as a wall of feedback.
 */
const SPECIMENS: Specimen[] = [
  {
    id: "field",
    at: { left: "6%", top: "14%" },
    atSm: { left: "5%", top: "7%" },
    side: "left",
    width: 244,
    noteAt: 900,
    replyAt: 4200,
    closeAt: 6900,
    note: "The label collides with the underline when it shrinks.",
    reply: "Lifted the floating label clear of the rule and matched the focus colour.",
    render: (draft) => <MaterialField draft={draft} label="Component name" value="Button" />,
  },
  {
    id: "rating",
    at: { right: "5%", top: "22%" },
    atSm: { right: "5%", top: "24%" },
    side: "right",
    width: 210,
    noteAt: 8300,
    replyAt: 11600,
    closeAt: 14300,
    note: "These stars are too small to hit on the first try.",
    reply: "Doubled the target. Should the empty ones keep the grey, or go outlined?",
    render: (draft) => <DaisyRating draft={draft} />,
  },
  {
    id: "switch",
    at: { left: "10%", top: "62%" },
    atSm: { left: "5%", top: "72%" },
    side: "left",
    width: 262,
    noteAt: 15700,
    replyAt: 19000,
    closeAt: 22400,
    note: "Off reads as disabled, not as a choice.",
    reply: "Raised the track contrast so off is clearly still yours to flip.",
    render: (draft) => <ShadcnSwitch draft={draft} />,
  },
  // Company: no notes, other houses, all of them working controls.
  {
    id: "avatars",
    at: { left: "27%", top: "7%" },
    side: "left",
    width: 150,
    small: true,
    render: () => <ChakraAvatarGroup />,
  },
  {
    id: "segmented",
    at: { right: "27%", top: "8%" },
    side: "right",
    width: 210,
    small: true,
    render: () => <AntSegmented />,
  },
  {
    id: "mbutton",
    at: { left: "30%", top: "15%" },
    side: "left",
    width: 170,
    small: true,
    render: () => <MaterialButton />,
  },
  {
    id: "chips",
    at: { left: "33%", top: "69%" },
    side: "left",
    width: 240,
    small: true,
    render: () => <MantineChips />,
  },
  {
    id: "steps",
    at: { right: "6%", top: "60%" },
    side: "right",
    width: 190,
    small: true,
    render: () => <AntSteps />,
  },
  {
    id: "slider",
    at: { right: "24%", top: "80%" },
    side: "right",
    width: 200,
    render: () => <HeroSlider />,
  },
]

const ANNOTATED = SPECIMENS.filter((s) => s.note)

export default function HeroCanvas() {
  const [t, setT] = createSignal(0)
  const [frozen, setFrozen] = createSignal<string | null>(null)
  const [wide, setWide] = createSignal(true)

  onMount(() => {
    const mq = window.matchMedia("(min-width: 1024px)")
    setWide(mq.matches)
    const onChange = (e: MediaQueryListEvent) => setWide(e.matches)
    mq.addEventListener("change", onChange)

    // One clock for the whole canvas; each note reads its own moments off it.
    let last = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const delta = now - last
      last = now
      if (!frozen()) setT((v) => (v + delta) % CYCLE)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    onCleanup(() => {
      mq.removeEventListener("change", onChange)
      cancelAnimationFrame(raf)
    })
  })

  const noteVisible = (s: Specimen) => s.noteAt !== undefined && t() > s.noteAt
  const replied = (s: Specimen) => s.replyAt !== undefined && t() > s.replyAt
  /** After the thread closes the pin stays, faded, the way a settled note reads. */
  const settled = (s: Specimen) => s.closeAt !== undefined && t() > s.closeAt

  /** Deterministic drift per tile, so the group breathes without syncing up. */
  const drift = (i: number) => ({
    "animation-duration": `${7 + (i % 5) * 1.4}s`,
    "animation-delay": `${(i % 7) * 0.9}s`,
  })

  return (
    <div class="pointer-events-none absolute inset-0">
      <For each={SPECIMENS}>
        {(s, i) => {
          const order = () => ANNOTATED.findIndex((a) => a.id === s.id)
          const isFrozen = () => frozen() === s.id
          const width = () => (wide() ? s.width : Math.min(s.width, 210))
          const shown = () => noteVisible(s)

          return (
            <div
              class={`pointer-events-auto absolute ${s.small ? "hidden xl:block" : ""}`}
              style={{ ...(wide() ? s.at : (s.atSm ?? s.at)), width: `${width()}px` }}
              onMouseEnter={() => s.note && setFrozen(s.id)}
              onMouseLeave={() => setFrozen(null)}
            >
              <div class={`float ${s.side === "right" ? "flex justify-end" : ""}`} style={drift(i())}>
                <div class="relative inline-block w-full">
                  {s.render(shown() && !replied(s))}
                  <Show when={shown()}>
                    <span class="pin-drop absolute -right-3.5 -top-3.5 z-30">
                      <Pin label={String(order() + 1)} author="human" matchesState={!settled(s)} />
                    </span>
                  </Show>
                </div>
              </div>

              {/* The product's own thread, not a lookalike. */}
              <Show when={(shown() && !settled(s) && wide()) || isFrozen()}>
                <div
                  class={`rise-in absolute top-[calc(100%+14px)] z-40 ${s.side === "right" ? "right-0" : "left-0"}`}
                >
                  <NoteThread
                    author="andrés"
                    createdLabel={replied(s) ? "4m" : "now"}
                    text={s.note}
                    replies={replied(s) ? [{ author: "agent", createdLabel: "now", text: s.reply! }] : []}
                  />
                </div>
              </Show>
            </div>
          )
        }}
      </For>
    </div>
  )
}
