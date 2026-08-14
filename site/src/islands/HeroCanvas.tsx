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
import { Region } from "../../../src/adapters/solid/chrome/Region"
import { NoteThread } from "../../../src/adapters/solid/chrome/NoteThread"
import { DemoCursor } from "./DemoCursor"
import { glide, drag, dragDuration, fitts, overshootPoint, OVERSHOOT_THRESHOLD, type Point } from "../lib/cursor-path"

/**
 * The hero performs the loop rather than describing it.
 *
 * A cursor travels to a component, pins a note or drags a region over it,
 * writes the note in the product's own composer, and submits. The agent
 * answers, the component unmounts and comes back changed, and the cursor
 * closes the thread and moves on. Every pin, region and thread on screen is
 * the product's own chrome; only the hand is scripted.
 */

interface Specimen {
  id: string
  at: JSX.CSSProperties
  atSm?: JSX.CSSProperties
  /** Phones get their own side of the stage; the stage's own top supplies
   *  the vertical, so an xs spot names left or right and nothing else. */
  atXs?: JSX.CSSProperties
  side: "left" | "right"
  width: number
  widthXs?: number
  small?: boolean
  /** Decoration a phone has no room for. */
  hideXs?: boolean
  render: (draft: boolean) => JSX.Element
}

const SPECIMENS: Specimen[] = [
  {
    id: "field",
    at: { left: "6%", top: "14%" },
    atSm: { left: "5%", top: "7%" },
    atXs: { left: "5%" },
    side: "left",
    width: 244,
    widthXs: 186,
    render: (draft) => <MaterialField draft={draft} label="Component name" value="Button" />,
  },
  {
    id: "rating",
    at: { right: "5%", top: "22%" },
    atSm: { right: "5%", top: "24%" },
    atXs: { right: "5%" },
    side: "right",
    width: 210,
    widthXs: 168,
    render: (draft) => <DaisyRating draft={draft} />,
  },
  {
    id: "switch",
    at: { left: "10%", top: "62%" },
    atSm: { left: "5%", top: "72%" },
    atXs: { left: "5%" },
    side: "left",
    width: 262,
    widthXs: 190,
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
    atSm: { right: "6%", top: "85%" },
    side: "right",
    width: 200,
    hideXs: true,
    render: () => <HeroSlider />,
  },
]

interface Scene {
  id: string
  kind: "pin" | "region"
  /** Where on the tile a pin lands, as fractions of its box. A region is
   *  centred on the component instead, so it has no spot to name. */
  at?: Point
  selector: string
  note: string
  reply: string
  /** The same answer at phone length. A reply that runs to three lines on a
   *  264px panel pushes the note off the bottom of the stage. */
  replyXs?: string
  /** Where the cursor puts the fix to the test, as fractions of the tile. */
  verifyAt: Point
}

const SCENES: Scene[] = [
  {
    id: "field",
    kind: "pin",
    at: { x: 0.34, y: 0.72 },
    selector: "MaterialField",
    note: "The label collides with the underline when it shrinks.",
    reply: "Lifted the floating label clear of the rule and matched the focus colour.",
    replyXs: "Lifted the label clear of the rule.",
    verifyAt: { x: 0.5, y: 0.62 },
  },
  {
    id: "rating",
    kind: "region",
    selector: "DaisyRating",
    note: "These stars are too small to hit on the first try.",
    reply: "Doubled the target. Should the empty ones stay grey, or go outlined?",
    replyXs: "Doubled the target. Grey, or outlined?",
    // The row is centred in its slot: this is the second star, not a gap.
    verifyAt: { x: 0.37, y: 0.5 },
  },
  {
    id: "switch",
    kind: "pin",
    at: { x: 0.07, y: 0.28 },
    selector: "ShadcnSwitch",
    note: "Off reads as disabled, not as a choice.",
    reply: "Raised the track contrast so off is clearly still yours to flip.",
    replyXs: "Raised the track contrast so off reads as a choice.",
    verifyAt: { x: 0.06, y: 0.2 },
  },
]

const SCENE_IDS = new Set(SCENES.map((s) => s.id))

interface Box {
  x: number
  y: number
  w: number
  h: number
}

/** Region carries min-w-40 / min-h-24; the drag math has to agree with it. */
const REGION_MIN_W = 160
const REGION_MIN_H = 96
/** Air left around the component inside the box it is selected by. Generous
 *  sideways, because the thing keeps its room when the fix makes it bigger. */
const REGION_PAD_X = 48
const REGION_PAD_Y = 32

/** One dial for the whole performance. */
const RATE = 1.1

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms * RATE))

/** The composer and thread: 320px on a desktop, narrower than a phone is. */
const PANEL = 320
const PANEL_XS = 264
const panelWidth = () => (window.innerWidth < 640 ? PANEL_XS : PANEL)
/** How tall a thread gets once the agent has answered and the reply lands. On
 *  a phone the dead reply box is hidden (see .note-opaque in global.css), so
 *  the same thread finishes shorter. */
const PANEL_H = 300
const PANEL_H_XS = 200
const panelHeight = () => (window.innerWidth < 640 ? PANEL_H_XS : PANEL_H)

/**
 * The band the performance is allowed to use. On a phone the copy owns the top
 * of the page and the HUD owns the floor, so the stage is what is left between
 * them. Both edges are measured rather than guessed: the copy's height moves
 * with the viewport, and a constant that was right at one size was covering the
 * subhead at every other.
 */
const COPY_GAP = 12
const stageTop = () => {
  const copy = document.querySelector("[data-hero-copy]")?.getBoundingClientRect().bottom
  return copy ? copy + COPY_GAP : 16
}
const stageBottom = () =>
  (document.querySelector("[data-landing-peek]")?.getBoundingClientRect().top ?? window.innerHeight) - 12

/** On a phone the note is wider than the gap beside any tile, so it can only
 *  go under the thing it is about. `clear` is that thing's box. */
const clamp = (p: Point, clear?: Box): Point => {
  const x = Math.max(16, Math.min(p.x, window.innerWidth - panelWidth() - 16))
  const xs = window.innerWidth < 640
  const lo = xs ? Math.max(stageTop(), clear ? clear.y + clear.h + 10 : 0) : 16
  const hi = (xs ? stageBottom() : window.innerHeight) - panelHeight() - 12
  // Too short to hold a whole note: keep the top of it under the copy anyway
  // and let the tail run beneath the HUD, which draws over it. Riding up onto
  // the headline is the one outcome worse than being clipped.
  if (lo > hi) return { x, y: lo }
  return { x, y: Math.min(Math.max(p.y, lo), hi) }
}

export default function HeroCanvas() {
  const [wide, setWide] = createSignal(true)
  const [narrow, setNarrow] = createSignal(false)
  const [staged, setStaged] = createSignal(SCENES[0].id)
  /** Where the phone stage starts, in px. Measured off the copy, so a wrapped
   *  headline or an edited subhead moves the tiles instead of colliding. */
  const [stage, setStage] = createSignal(0)
  const [cursor, setCursor] = createSignal<Point>({ x: 0, y: 0 })
  const [cursorOn, setCursorOn] = createSignal(false)
  const [pressed, setPressed] = createSignal(false)

  const [pending, setPending] = createSignal<{ x: number; y: number; selector: string; text: string } | null>(null)
  const [thread, setThread] = createSignal<{
    x: number
    y: number
    note: string
    reply?: string
    thinking?: boolean
    selector: string
  } | null>(null)
  /** The one specimen currently under the agent's hand, if any. */
  const [working, setWorking] = createSignal<string | null>(null)
  const [region, setRegion] = createSignal<Box | null>(null)
  const [pin, setPin] = createSignal<(Point & { label: string }) | null>(null)
  const [settled, setSettled] = createSignal<(Point & { label: string })[]>([])

  /** Bumping a specimen's key unmounts it and mounts the changed one. */
  const [mount, setMount] = createSignal<Record<string, number>>({})
  const [refined, setRefined] = createSignal<string[]>([])

  const tiles = new Map<string, HTMLDivElement>()
  let composerSave: HTMLButtonElement | undefined
  let threadHost: HTMLDivElement | undefined
  let side = 1

  const keyOf = (id: string) => mount()[id] ?? 1
  const isDraft = (id: string) => !refined().includes(id)

  /** Three tiers: desktop scatter, tablet scatter, phone edges. */
  const spotOf = (s: Specimen) =>
    wide()
      ? s.at
      : narrow()
        ? { ...(s.atXs ?? s.atSm ?? s.at), top: `${stage()}px` }
        : (s.atSm ?? s.at)
  const widthOf = (s: Specimen) =>
    wide() ? s.width : narrow() ? (s.widthXs ?? Math.min(s.width, 186)) : Math.min(s.width, 210)

  const boxOf = (id: string): Box | null => {
    const el = tiles.get(id)
    if (!el) return null
    const r = el.getBoundingClientRect()
    return { x: r.left, y: r.top, w: r.width, h: r.height }
  }

  /**
   * What a tile actually draws, rather than the slot it draws in. Tiles are
   * fixed-width so the scatter holds still; the component inside is usually
   * narrower. Measuring the slot would hang a region off to one side of the
   * thing it is about.
   */
  const contentBoxOf = (id: string): Box | null => {
    const root = tiles.get(id)?.querySelector(".swap-in")?.firstElementChild
    const rects = root ? Array.from(root.children, (k) => k.getBoundingClientRect()) : []
    if (!rects.length) return null
    const x = Math.min(...rects.map((r) => r.left))
    const y = Math.min(...rects.map((r) => r.top))
    return {
      x,
      y,
      w: Math.max(...rects.map((r) => r.right)) - x,
      h: Math.max(...rects.map((r) => r.bottom)) - y,
    }
  }

  /**
   * The box a drag has to leave behind: centred on the component and never
   * smaller than Region's own minimums. Drawn box and dragged box are the
   * same box, so the cursor finishes on the corner it pulled.
   */
  const regionBoxOf = (id: string, fallback: Box): Box => {
    const c = contentBoxOf(id) ?? fallback
    const w = Math.max(REGION_MIN_W, c.w + REGION_PAD_X * 2)
    const h = Math.max(REGION_MIN_H, c.h + REGION_PAD_Y * 2)
    return { x: c.x + c.w / 2 - w / 2, y: c.y + c.h / 2 - h / 2, w, h }
  }

  /** One throw of the cursor, bending one way and correcting if it is far. */
  async function moveTo(target: Point, targetWidth: number) {
    const from = cursor()
    const distance = Math.hypot(target.x - from.x, target.y - from.y)
    side = -side
    if (distance > OVERSHOOT_THRESHOLD) {
      const past = overshootPoint(from, target)
      await glide(from, past, fitts(distance, targetWidth) * RATE, side, setCursor)
      await sleep(70)
      await glide(past, target, 190 * RATE, -side, setCursor)
    } else {
      await glide(from, target, fitts(distance, targetWidth) * RATE, side, setCursor)
    }
  }

  async function click() {
    setPressed(true)
    await sleep(110)
    setPressed(false)
    await sleep(90)
  }

  async function typeOut(text: string) {
    for (let i = 1; i <= text.length; i++) {
      setPending((p) => (p ? { ...p, text: text.slice(0, i) } : p))
      await sleep(14 + (i % 6) * 8)
    }
  }

  /**
   * The agent answers in tokens, not keystrokes. Streaming the reply a word at
   * a time is both truer to what is happening and visibly a different hand
   * from the human's character-by-character typing above it.
   */
  async function streamReply(text: string) {
    const words = text.split(" ")
    for (let i = 1; i <= words.length; i++) {
      // The dots hand over to the first word, never to an empty row.
      setThread((t) => (t ? { ...t, thinking: false, reply: words.slice(0, i).join(" ") } : t))
      await sleep(42 + (i % 4) * 16)
    }
  }

  async function playScene(scene: Scene, index: number) {
    // On a phone the tile has to be on stage before it can be measured.
    if (narrow() && staged() !== scene.id) {
      setStaged(scene.id)
      await sleep(520)
    }
    const box = boxOf(scene.id)
    if (!box) return
    const drawn = scene.kind === "region" ? regionBoxOf(scene.id, box) : null
    const spot = scene.at ?? { x: 0.5, y: 0.5 }
    const anchor = drawn
      ? { x: drawn.x, y: drawn.y }
      : { x: box.x + box.w * spot.x, y: box.y + box.h * spot.y }

    await moveTo(anchor, Math.min(box.w, 140))
    await sleep(180)

    if (drawn) {
      // Corner to opposite corner of the box that was measured above.
      const end = { x: drawn.x + drawn.w, y: drawn.y + drawn.h }
      setPressed(true)
      setRegion({ x: anchor.x, y: anchor.y, w: 0, h: 0 })
      // The pin is in hand for the whole pull: it travels with the cursor
      // rather than appearing on a corner once the box is drawn.
      setPin({ x: anchor.x, y: anchor.y, label: String(index + 1) })
      const pull = Math.hypot(end.x - anchor.x, end.y - anchor.y)
      await drag(anchor, end, dragDuration(pull) * RATE, (p) => {
        setCursor(p)
        setPin((q) => (q ? { ...q, x: p.x, y: p.y } : q))
        setRegion({
          x: Math.min(anchor.x, p.x),
          y: Math.min(anchor.y, p.y),
          w: Math.abs(p.x - anchor.x),
          h: Math.abs(p.y - anchor.y),
        })
      })
      await sleep(140)
      setPressed(false)
      await sleep(200)
    } else {
      await click()
    }

    // Wherever the hand came to rest is where the note lives — the release
    // point of a pull, the click point of a tap. Never a corner of the box.
    const foot = cursor()
    setPin({ x: foot.x, y: foot.y, label: String(index + 1) })
    const panel = clamp({ x: foot.x, y: foot.y + 16 }, narrow() ? box : undefined)
    setPending({ x: panel.x, y: panel.y, selector: scene.selector, text: "" })
    await sleep(260)
    await typeOut(scene.note)
    await sleep(300)

    if (composerSave) {
      const s = composerSave.getBoundingClientRect()
      await moveTo({ x: s.left + s.width / 2, y: s.top + s.height / 2 }, s.width)
    }
    await click()

    const at = pending()
    setThread({ x: at?.x ?? panel.x, y: at?.y ?? panel.y, note: scene.note, selector: scene.selector })
    setPending(null)

    // The agent turn is four beats rather than one instant. It used to be a
    // wait with nothing on screen followed by the answer, the swap and the
    // resolve all landing in the same frame, in two places at once.

    // One: the note is taken, and the hand lets go to watch.
    await sleep(240)
    setThread((t) => (t ? { ...t, thinking: true } : t))
    const held = cursor()
    await glide(held, { x: held.x - 22, y: held.y + 30 }, 420 * RATE, 1, setCursor)
    await sleep(160)

    // Two: the component goes under the veil. The sweep runs on a 1150ms
    // cycle, and the veil has to stay up long enough to repeat it two or
    // three times: one pass reads as a wipe, several read as work underway.
    setWorking(scene.id)
    await sleep(700)

    // Three: the change is made where it cannot be seen, and the answer
    // streams in while it happens.
    setRefined((v) => [...v, scene.id])
    setMount((m) => ({ ...m, [scene.id]: keyOf(scene.id) + 1 }))
    await sleep(520)
    await streamReply(narrow() && scene.replyXs ? scene.replyXs : scene.reply)

    // Four: the veil lifts on the component the answer just described, so
    // both payoffs resolve together, in the one place the eye already is.
    await sleep(460)
    setWorking(null)
    await sleep(900)

    // Try it. The components are real controls, so this is a real click.
    const after = boxOf(scene.id)
    if (after) {
      const target = { x: after.x + after.w * scene.verifyAt.x, y: after.y + after.h * scene.verifyAt.y }
      await moveTo(target, 44)
      await click()
      // Only ever operate the component the note is about: a stray hit on the
      // page's own chrome would arm note mode or follow a link.
      const el = document.elementFromPoint(target.x, target.y) as HTMLElement | null
      const tile = tiles.get(scene.id)
      if (el && tile?.contains(el)) el.closest("button")?.click()
      if (el instanceof HTMLInputElement) el.focus()
      await sleep(1300)
      if (el instanceof HTMLInputElement) el.blur()
    }

    if (threadHost) {
      const resolve = threadHost.querySelector("button")
      if (resolve) {
        const b = resolve.getBoundingClientRect()
        await moveTo({ x: b.left + b.width / 2, y: b.top + b.height / 2 }, b.width)
        await click()
      }
    }

    setThread(null)
    setRegion(null)
    setPin(null)
    setSettled((v) => [...v, { ...foot, label: String(index + 1) }])
    await sleep(650)
  }

  onMount(() => {
    const mq = window.matchMedia("(min-width: 1024px)")
    setWide(mq.matches)
    const onChange = (e: MediaQueryListEvent) => setWide(e.matches)
    mq.addEventListener("change", onChange)

    const xs = window.matchMedia("(max-width: 639px)")
    setNarrow(xs.matches)
    const onXs = (e: MediaQueryListEvent) => setNarrow(e.matches)
    xs.addEventListener("change", onXs)

    // The copy is laid out by the page, not by this island, so the stage can
    // only be known once it has been measured. Re-measured on resize because a
    // rotation or an address bar collapsing rewraps the headline.
    const measure = () => setStage(stageTop())
    measure()
    window.addEventListener("resize", measure)
    window.addEventListener("orientationchange", measure)

    const still = window.matchMedia("(prefers-reduced-motion: reduce)")
    let stopped = false

    const loop = async () => {
      // Reduced motion gets the finished state and no performance.
      if (still.matches) {
        setRefined(SCENES.map((s) => s.id))
        return
      }
      await sleep(900)
      setCursor({ x: window.innerWidth * 0.62, y: window.innerHeight * 0.78 })
      setCursorOn(true)
      while (!stopped) {
        for (const [i, scene] of SCENES.entries()) {
          if (stopped) return
          await playScene(scene, i)
        }
        await sleep(900)
        // Back to the top: the components return to their drafts.
        setSettled([])
        setRefined([])
        setStaged(SCENES[0].id)
        setMount((m) => {
          const next = { ...m }
          for (const s of SCENES) next[s.id] = (next[s.id] ?? 1) + 1
          return next
        })
        await sleep(1200)
      }
    }
    void loop()

    onCleanup(() => {
      stopped = true
      mq.removeEventListener("change", onChange)
      xs.removeEventListener("change", onXs)
      window.removeEventListener("resize", measure)
      window.removeEventListener("orientationchange", measure)
    })
  })

  return (
    <>
      <div class="pointer-events-none absolute inset-0">
        <For each={SPECIMENS}>
          {(s, i) => (
            <div
              ref={(el) => tiles.set(s.id, el)}
              class={`pointer-events-auto absolute ${s.small ? "hidden xl:block" : ""} ${
                narrow() && (s.hideXs || (SCENE_IDS.has(s.id) && staged() !== s.id)) ? "hidden" : ""
              }`}
              style={{ ...spotOf(s), width: `${widthOf(s)}px` }}
            >
              <div class="fade-up" style={{ "animation-delay": `${120 + (i() % 9) * 90}ms` }}>
                <div
                  class={`float ${s.side === "right" ? "flex justify-end" : ""}`}
                  style={{ "animation-duration": `${7 + (i() % 5) * 1.4}s`, "animation-delay": `${(i() % 7) * 0.9}s` }}
                >
                  <div class={`agent-work relative inline-block w-full ${working() === s.id ? "working" : ""}`}>
                    <div class="agent-body">
                      {/* Keyed: the change arrives as a real unmount and mount. */}
                      <Show when={keyOf(s.id)} keyed>
                        <div class="swap-in">{s.render(isDraft(s.id))}</div>
                      </Show>
                    </div>
                    {/* Always mounted, so it can fade out as well as in. */}
                    <span class="agent-veil pointer-events-none" aria-hidden="true" />
                  </div>
                </div>
              </div>
            </div>
          )}
        </For>
      </div>

      {/* Everything the cursor makes sits above the vignette. */}
      <Show when={region()}>
        {(r) => (
          <div
            class="region-exact pointer-events-none absolute z-30"
            style={{ left: `${r().x}px`, top: `${r().y}px`, width: `${r().w}px`, height: `${r().h}px` }}
          >
            <Region open inert />
          </div>
        )}
      </Show>

      <For each={settled()}>
        {(p) => (
          <span class="pointer-events-none absolute z-30" style={{ left: `${p.x - 14}px`, top: `${p.y - 14}px` }}>
            <Pin label={p.label} author="human" matchesState={false} />
          </span>
        )}
      </For>

      <Show when={pin()}>
        {(p) => (
          <span
            class="pin-drop pointer-events-none absolute z-40"
            style={{ left: `${p().x - 14}px`, top: `${p().y - 14}px` }}
          >
            <Pin label={p().label} author="human" />
          </span>
        )}
      </Show>

      {/* The product's composer, markup for markup. */}
      <Show when={pending()}>
        {(p) => (
          <div
            class="glass note-opaque rise-in pointer-events-none absolute z-40 rounded-2xl p-4"
            style={{ left: `${p().x}px`, top: `${p().y}px`, width: `${narrow() ? PANEL_XS : PANEL}px` }}
          >
            <div class="h-14 w-full text-base leading-relaxed text-zinc-800 sm:h-20">
              <Show when={p().text} fallback={<span class="text-zinc-300">What feels off?</span>}>
                {p().text}
                <span class="caret ml-px inline-block h-[1.1em] w-px translate-y-[3px] bg-zinc-400" />
              </Show>
            </div>
            <div class="mt-2 flex items-center justify-between">
              <span class="max-w-32 truncate font-mono text-base text-zinc-300">{p().selector}</span>
              <div class="flex gap-4">
                <span class="text-base text-zinc-400">cancel</span>
                <button ref={composerSave} type="button" class="text-base font-semibold text-zinc-900">
                  save
                </button>
              </div>
            </div>
          </div>
        )}
      </Show>

      <Show when={thread()}>
        {(t) => (
          <div
            ref={threadHost}
            class="note-opaque rise-in pointer-events-none absolute z-40 [&>div]:w-(--panel)"
            style={{ left: `${t().x}px`, top: `${t().y}px`, "--panel": `${narrow() ? PANEL_XS : PANEL}px` }}
          >
            <NoteThread
              author="andrés"
              createdLabel={t().reply ? "1m" : "now"}
              text={t().note}
              thinking={t().thinking}
              replies={t().reply ? [{ author: "agent", createdLabel: "now", text: t().reply! }] : []}
            />
          </div>
        )}
      </Show>

      <DemoCursor x={cursor().x} y={cursor().y} visible={cursorOn()} pressed={pressed()} />
    </>
  )
}
