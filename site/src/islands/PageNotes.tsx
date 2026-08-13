import { createSignal, onCleanup, onMount, For, Show } from "solid-js"
import { AddNote } from "../../../src/adapters/solid/chrome/AddNote"
import { GhostPin } from "../../../src/adapters/solid/chrome/GhostPin"
import { Pin } from "../../../src/adapters/solid/chrome/Pin"
import { NoteThread } from "../../../src/adapters/solid/chrome/NoteThread"
import type { SteerNote } from "../../../src/core/model"

/**
 * Note mode on the marketing page itself, using the product's own pill, ghost
 * pin, pins and threads. Notes go to localStorage here; in a real host they
 * are JSON files in the repo.
 */

const KEY = "steerui:page-notes"

function load(): SteerNote[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as SteerNote[]
  } catch {
    return []
  }
}

function describe(el: Element | null): string {
  if (!el) return "body"
  return el.closest("[data-steer]")?.getAttribute("data-steer") ?? el.tagName.toLowerCase()
}

function ago(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (seconds < 60) return "now"
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
  return `${Math.floor(seconds / 3600)}h`
}

export default function PageNotes() {
  const [notes, setNotes] = createSignal<SteerNote[]>([])
  const [noteMode, setNoteMode] = createSignal(false)
  const [ghost, setGhost] = createSignal<{ x: number; y: number } | null>(null)
  const [draft, setDraft] = createSignal<{ x: number; y: number; selector: string } | null>(null)
  const [text, setText] = createSignal("")
  const [open, setOpen] = createSignal<string | null>(null)

  let input: HTMLInputElement | undefined

  const persist = (next: SteerNote[]) => {
    setNotes(next)
    try {
      localStorage.setItem(KEY, JSON.stringify(next))
    } catch {
      /* a blocked store is a visible no-op, never a crash */
    }
  }

  const disarm = () => {
    setNoteMode(false)
    setGhost(null)
    document.body.classList.remove("no-cursor")
  }
  const arm = () => {
    setNoteMode(true)
    document.body.classList.add("no-cursor")
  }

  onMount(() => {
    setNotes(load())

    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      const typing = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")
      if (e.key === "Escape") {
        setDraft(null)
        setText("")
        disarm()
        return
      }
      if (typing) return
      if (e.key === "c" || e.key === "C") {
        e.preventDefault()
        noteMode() ? disarm() : arm()
      }
    }
    const onMove = (e: MouseEvent) => noteMode() && setGhost({ x: e.pageX, y: e.pageY })
    // Capture phase, so a pin lands on links and buttons instead of following them.
    const onClick = (e: MouseEvent) => {
      if (!noteMode()) return
      e.preventDefault()
      e.stopPropagation()
      setDraft({
        x: e.pageX,
        y: e.pageY,
        selector: describe(document.elementFromPoint(e.clientX, e.clientY)),
      })
      disarm()
      queueMicrotask(() => input?.focus())
    }

    document.addEventListener("keydown", onKey)
    document.addEventListener("mousemove", onMove)
    document.addEventListener("click", onClick, true)
    onCleanup(() => {
      document.removeEventListener("keydown", onKey)
      document.removeEventListener("mousemove", onMove)
      document.removeEventListener("click", onClick, true)
      document.body.classList.remove("no-cursor")
    })
  })

  const commit = () => {
    const d = draft()
    if (!d || !text().trim()) return
    persist([
      ...notes(),
      {
        id: `n${Date.now().toString(36)}`,
        component: "landing",
        stateUrl: "/",
        selector: d.selector,
        coords: { x: d.x / window.innerWidth, y: d.y / window.innerHeight },
        text: text().trim(),
        author: "andrés",
        status: "open",
        created: new Date().toISOString(),
        replies: [],
      },
    ])
    setDraft(null)
    setText("")
  }

  const resolve = (id: string) =>
    persist(notes().map((n) => (n.id === id ? { ...n, status: "resolved" as const } : n)))

  return (
    <>
      <div class="pointer-events-none absolute inset-0 z-40">
        <For each={notes()}>
          {(n, i) => (
            <span
              class="pointer-events-auto absolute"
              style={{ left: `${n.coords.x * window.innerWidth}px`, top: `${n.coords.y * window.innerHeight}px` }}
            >
              <Pin
                label={String(i() + 1)}
                author={n.author === "agent" ? "agent" : "human"}
                matchesState={n.status === "open"}
                onPointerDown={() => setOpen(open() === n.id ? null : n.id)}
              />
              <Show when={open() === n.id}>
                <div class="absolute left-9 top-0">
                  <NoteThread
                    author={n.author}
                    createdLabel={ago(n.created)}
                    text={n.text}
                    onResolve={() => resolve(n.id)}
                  />
                </div>
              </Show>
            </span>
          )}
        </For>

        <Show when={draft()}>
          {(d) => (
            <div
              class="glass pointer-events-auto absolute w-80 rounded-2xl p-4"
              style={{ left: `${d().x}px`, top: `${d().y}px` }}
            >
              <div class="mb-2 font-mono text-base text-zinc-400">{d().selector}</div>
              <input
                ref={input}
                value={text()}
                onInput={(e) => setText(e.currentTarget.value)}
                onKeyDown={(e) => e.key === "Enter" && commit()}
                placeholder="What feels off?"
                class="w-full rounded-xl bg-black/[0.04] px-3 py-2 text-base outline-none placeholder:text-zinc-400"
              />
              <div class="mt-2 flex items-center justify-between font-mono text-base text-zinc-300">
                <span>enter to save</span>
                <button type="button" class="hover:text-zinc-500" onClick={() => setDraft(null)}>
                  cancel
                </button>
              </div>
            </div>
          )}
        </Show>
      </div>

      <Show when={noteMode() && ghost()}>
        {(g) => (
          <div class="pointer-events-none absolute z-50" style={{ left: `${g().x}px`, top: `${g().y}px` }}>
            <GhostPin />
          </div>
        )}
      </Show>

      <div class="absolute bottom-8 left-1/2 z-50 -translate-x-1/2">
        <AddNote noteMode={noteMode()} onClick={() => (noteMode() ? disarm() : arm())} />
      </div>
    </>
  )
}
