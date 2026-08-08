---
name: bench
description: Applies bench, the agent-first component workshop (open-source "Storybook for the agentic era"), to any project, and operates it where installed. Use when the user asks to "add bench", "install bench", "set up a component workshop/gallery/playground", "storybook but for agents", "give components addressable states", "let me leave notes on components", or, in a host where bench is installed, to work on components, check component feedback, or "run bench doctor". Four verbs - install (wire plugin + routes + scaffold), work (the notes protocol: read, reproduce via stateUrl, fix, reply, resolve), doctor (deterministic health checks), uninstall (clean removal, never silently destroying notes).
---

# Bench: apply the component-workshop pattern to this project

Bench gives a host project a derived component catalog (`/__bench`), state-addressable rendering (`/__bench/<slug>?prop=value`), and feedback-as-data (notes pinned to state URLs, committed to git). The engine is a tested library at `~/onc9-systems/bench` (the lab). Your job is to instantiate it into the host's stack, then operate it by protocol.

## The one principle that governs every decision

**Everything is derived from source or captured as data; the hand-authored story file must never exist.** If an install step tempts you to author a per-component artifact (a story, a registration list, a config entry per component), you are doing it wrong: the manifest derives it, or a fixture/note captures it. The contract (manifest schema, `/__bench` URL grammar, notes shape, `.bench/` layout) is identical in every host; only extractors, transports, and render surfaces adapt.

Five invariants are non-negotiable in anything you scaffold (SPEC.md §1 has the full statements):
1. Manifest derived, never authored.
2. Every state addressable as a URL (composed children included).
3. Notes append-preserving; resolution is a status flip, deletion is a human act.
4. Degrade visibly, never crash.
5. Contract framework-neutral.

## The contract you are instantiating

```
Engine (copy from lab, do not fork logic):
  core/         extraction, manifest, state URLs, note transitions, doctor, engine facade
  ports/        SourceStore+ManifestStore required; FixtureStore+NoteStore optional
  adapters      node-fs (stores), vite (driving: watch, HMR suppression, HTTP API)
Render surface (per framework; Solid is the reference):
  src/bench/    BenchIndex (specimen sheet), BenchComponent (canvas), data.ts client
  registry glue THE host-side piece: registerComponents(import.meta.glob(...))
Data (.bench/, committed except the manifest):
  fixtures/*.json   named states as data
  notes/*.json      feedback pinned to state URLs
  manifest.json     derived; gitignored
HTTP API: GET manifest | GET doctor | GET fixtures/<slug> | GET/POST notes/<slug> (+ /move /reply /resolve)
```

## Workflow

### install

1. **Detect** the host: bundler (Vite? else the standalone server + proxy), framework (Solid and React both have full surfaces), component dir, router, Tailwind version, and whether prop types are imported/intersections (turn on `typecheck`). Read `references/install-playbook.md` and follow the stack recipe. If the framework has no surface (Svelte, Vue), say so honestly and stop; building one is lab work, not install-time improvisation.
2. **Copy** the engine and surface per the playbook (commit-hash comment as drift receipt), wire the plugin into the bundler config, mount `/__bench` routes, write the registry glue, scaffold `.bench/` (gitignore the manifest).
3. **Inject** the CLAUDE.md block (`references/claude-md-block.md`): bench-is-truth, verify-after-edit, the notes protocol.
4. **Verify**: start dev, `GET /__bench/api/doctor` must pass, open `/__bench` in Playwright and confirm the specimen sheet renders live components. Idempotent: re-running install repairs, never duplicates.

### work (the default verb where bench is installed)

Precondition: run **doctor** first; repair before working. Then the protocol:
- Before touching a component, read its open notes (`.bench/notes/<slug>.json` or the API). Reproduce each via its `stateUrl` in Playwright.
- After changing a component, re-verify its states AND its `internal` usages (the manifest's usage scan tells you what composes it).
- Reply as `author: "agent"` (renders indigo); resolve only what you actually fixed, in the same change as the fix.
- Flag findings as new notes with a precise `stateUrl`.
- Bench is the unit test for components. It MUST NOT absorb flow-level verification: real app flows stay with Playwright against the app's own routes.

### doctor

`GET /__bench/api/doctor` (dev server must be up; a dead server is itself the first finding). Checks: manifest fresh vs source, fixtures parse and reference known props, open notes point at existing components. Deterministic checks come from the engine; you supply judgment for repairs (regenerate, fix fixture, flag orphaned notes to the human).

### uninstall

Remove: plugin wiring, routes, copied engine + surface, registry glue, CLAUDE.md block, `.bench/` scaffold, deps that became orphaned. **Open notes are human feedback: list them, offer archive (move to `docs/bench-notes-archive/`) vs delete, never silently destroy.**

## Promote back

Anything you build in a host that the lab lacks (a React render surface, a Next driving adapter, a better extractor) gets generalized, tested in the lab (`~/onc9-systems/bench`), and recorded in `references/portability.md`. The human gates what enters the canon. Route via the `onc9-primitives` skill.
