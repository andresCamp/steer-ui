import { createResource, For, Show, Suspense } from "solid-js"
import { Dynamic } from "solid-js/web"
import { A, useNavigate } from "@solidjs/router"
import {
  coerceProps,
  fetchFixture,
  fetchManifest,
  fetchNotes,
  registry,
  stateUrl,
  type BenchComponentSpec,
} from "./data"

/**
 * The library as a type-specimen sheet: components rendered live on the
 * page, one section per component, states flowing inline. No cards.
 */
function Specimen(props: { spec: BenchComponentSpec; index: number }) {
  const navigate = useNavigate()
  const [fixture] = createResource(() => props.spec.slug, fetchFixture)
  const [notes] = createResource(() => props.spec.slug, fetchNotes)

  const states = () => {
    const all = fixture()?.states ?? {}
    const names = Object.keys(all)
    return names.length > 0 ? names : ["default"]
  }
  const valuesFor = (state: string) => ({
    ...(fixture()?.states?.default ?? {}),
    ...(fixture()?.states?.[state] ?? {}),
  })

  /** Canonical key for a knob-value set, order-independent. */
  const stateKey = (values: Record<string, string>) =>
    JSON.stringify(Object.entries(values).sort(([a], [b]) => a.localeCompare(b)))

  const noteKey = (noteStateUrl: string) => {
    const values: Record<string, string> = {}
    new URLSearchParams(noteStateUrl.split("?")[1] ?? "").forEach((v, k) => (values[k] = v))
    return stateKey(values)
  }

  const openNotes = () => (notes() ?? []).filter((n) => n.status === "open")

  /** Open notes written against a specific fixture state. */
  const notesForState = (state: string) =>
    openNotes().filter((n) => noteKey(n.stateUrl) === stateKey(valuesFor(state))).length

  /** Open notes whose state matches no fixture tile (custom knob combos). */
  const unmatchedNotes = () => {
    const tileKeys = new Set(states().map((s) => stateKey(valuesFor(s))))
    return openNotes().filter((n) => !tileKeys.has(noteKey(n.stateUrl))).length
  }

  return (
    <section
      class="rise-in grid grid-cols-[10rem_1fr] gap-8 border-t border-black/[0.05] py-14"
      style={{ "animation-delay": `${80 + props.index * 60}ms` }}
      data-bench-specimen={props.spec.slug}
    >
      <div class="pt-1">
        <A
          href={`/__bench/${props.spec.slug}`}
          class="cursor-pointer font-mono text-[17px] font-medium text-zinc-900 transition-colors hover:text-zinc-500"
        >
          {props.spec.name}
        </A>
        <Show when={unmatchedNotes() > 0}>
          <span
            class="ml-2 inline-block size-2 rounded-full bg-amber-400 align-middle"
            title={`${unmatchedNotes()} open note${
              unmatchedNotes() === 1 ? "" : "s"
            } on custom states`}
          />
        </Show>
        <Show when={props.spec.description}>
          <p class="mt-2 text-base leading-relaxed text-zinc-400">{props.spec.description}</p>
        </Show>
      </div>

      <div class="flex flex-wrap items-center gap-x-4 gap-y-4">
        <For each={states()}>
          {(state) => (
            <div
              class="group relative cursor-pointer rounded-2xl p-6 transition-colors duration-200 hover:bg-black/[0.03]"
              onClick={() => navigate(stateUrl(props.spec.slug, valuesFor(state)))}
              data-bench-state-preview={state}
            >
              <span class="pointer-events-none inline-block">
                <Show when={registry[props.spec.name]}>
                  <Dynamic
                    component={registry[props.spec.name]}
                    {...coerceProps(props.spec, valuesFor(state))}
                  />
                </Show>
              </span>
              <span class="pointer-events-none absolute -bottom-1 left-6 font-mono text-base text-zinc-300 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                {state}
              </span>
              {/* comment indicator on the state the notes belong to */}
              <Show when={notesForState(state) > 0}>
                <span
                  class="pointer-events-none absolute right-2 top-2 flex size-5 items-center justify-center rounded-full bg-amber-400 font-mono text-[13px] font-semibold text-white shadow-[0_1px_6px_rgba(217,119,6,0.4)]"
                  title={`${notesForState(state)} open note${notesForState(state) === 1 ? "" : "s"}`}
                  data-bench-state-notes={state}
                >
                  {notesForState(state)}
                </span>
              </Show>
            </div>
          )}
        </For>
      </div>
    </section>
  )
}

export function BenchIndex() {
  const [manifest] = createResource(fetchManifest)

  return (
    <div class="mx-auto max-w-5xl px-10 pb-24 pt-16">
      <header class="rise-in mb-16 flex items-baseline justify-between">
        <h1 class="font-mono text-[17px] font-semibold tracking-tight">bench</h1>
        <A href="/" class="cursor-pointer text-base text-zinc-400 transition-colors hover:text-zinc-900">
          app
        </A>
      </header>

      <Suspense>
        <For each={manifest()?.components}>{(spec, i) => <Specimen spec={spec} index={i()} />}</For>
        <Show when={manifest()}>
          <p class="mt-14 font-mono text-base text-zinc-300">
            {manifest()!.components.length} components · derived from source
          </p>
        </Show>
      </Suspense>
    </div>
  )
}
