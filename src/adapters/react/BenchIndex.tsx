import { createElement, useEffect, useState } from "react"
import { Link, useNavigate } from "react-router"
import {
  coerceProps,
  fetchFixture,
  fetchManifest,
  fetchNotes,
  parseStateUrl,
  resolveComponent,
  stateKey,
  stateUrl,
  stringifyFixtureValues,
  type BenchComponentSpec,
  type BenchFixture,
  type BenchManifest,
  type BenchNote,
} from "./data"

/**
 * The library as a type-specimen sheet: components rendered live on the
 * page, one section per component, states flowing inline. No cards.
 * React port of the Solid reference surface; keep the two in lockstep.
 */
function Specimen({ spec, index }: { spec: BenchComponentSpec; index: number }) {
  const navigate = useNavigate()
  const [fixture, setFixture] = useState<BenchFixture>()
  const [notes, setNotes] = useState<BenchNote[]>([])

  useEffect(() => {
    let ignore = false
    fetchFixture(spec.slug).then((f) => !ignore && setFixture(f))
    fetchNotes(spec.slug).then((n) => !ignore && setNotes(n))
    return () => {
      ignore = true
    }
  }, [spec.slug])

  const allStates = fixture?.states ?? {}
  const states = Object.keys(allStates).length > 0 ? Object.keys(allStates) : ["default"]
  const valuesFor = (state: string) =>
    stringifyFixtureValues({
      ...(fixture?.states?.default ?? {}),
      ...(fixture?.states?.[state] ?? {}),
    })

  const noteKey = (noteStateUrl: string) => stateKey(parseStateUrl(noteStateUrl).values)
  const openNotes = notes.filter((n) => n.status === "open")
  const notesForState = (state: string) =>
    openNotes.filter((n) => noteKey(n.stateUrl) === stateKey(valuesFor(state))).length
  const tileKeys = new Set(states.map((s) => stateKey(valuesFor(s))))
  const unmatchedNotes = openNotes.filter((n) => !tileKeys.has(noteKey(n.stateUrl))).length

  return (
    <section
      className="rise-in grid grid-cols-[10rem_1fr] gap-8 border-t border-black/[0.05] py-14"
      style={{ animationDelay: `${80 + index * 60}ms` }}
      data-bench-specimen={spec.slug}
    >
      <div className="pt-1">
        <Link
          to={`/__bench/${spec.slug}`}
          className="cursor-pointer font-mono text-[17px] font-medium text-zinc-900 transition-colors hover:text-zinc-500"
        >
          {spec.name}
        </Link>
        {unmatchedNotes > 0 && (
          <span
            className="ml-2 inline-block size-2 rounded-full bg-amber-400 align-middle"
            title={`${unmatchedNotes} open note${unmatchedNotes === 1 ? "" : "s"} on custom states`}
          />
        )}
        {spec.description && (
          <p className="mt-2 text-base leading-relaxed text-zinc-400">{spec.description}</p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-4">
        {states.map((state) => {
          const component = resolveComponent(spec.name, spec.target)
          return (
            <div
              key={state}
              className="group relative cursor-pointer rounded-2xl p-6 transition-colors duration-200 hover:bg-black/[0.03]"
              onClick={() => navigate(stateUrl(spec.slug, valuesFor(state)))}
              data-bench-state-preview={state}
            >
              <span className="pointer-events-none inline-block">
                {component && createElement(component, coerceProps(spec, valuesFor(state)))}
              </span>
              <span className="pointer-events-none absolute -bottom-1 left-6 font-mono text-base text-zinc-300 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                {state}
              </span>
              {notesForState(state) > 0 && (
                <span
                  className="pointer-events-none absolute right-2 top-2 flex size-5 items-center justify-center rounded-full bg-amber-400 font-mono text-[13px] font-semibold text-white shadow-[0_1px_6px_rgba(217,119,6,0.4)]"
                  title={`${notesForState(state)} open note${notesForState(state) === 1 ? "" : "s"}`}
                  data-bench-state-notes={state}
                >
                  {notesForState(state)}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

export function BenchIndex() {
  const [manifest, setManifest] = useState<BenchManifest>()

  useEffect(() => {
    let ignore = false
    fetchManifest().then((m) => !ignore && setManifest(m))
    return () => {
      ignore = true
    }
  }, [])

  return (
    <div className="mx-auto max-w-5xl px-10 pb-24 pt-16">
      <header className="rise-in mb-16 flex items-baseline justify-between">
        <h1 className="font-mono text-[17px] font-semibold tracking-tight">bench</h1>
        <Link
          to="/"
          className="cursor-pointer text-base text-zinc-400 transition-colors hover:text-zinc-900"
        >
          app
        </Link>
      </header>

      {manifest?.components.map((spec, i) => (
        <Specimen key={spec.slug} spec={spec} index={i} />
      ))}
      {manifest && (
        <p className="mt-14 font-mono text-base text-zinc-300">
          {manifest.components.length} components · derived from source
        </p>
      )}
    </div>
  )
}
