# Handoff: steer-ui → primitive build

> **Status: executed 2026-08-07.** The graduation this document commissioned is done: lab (`src/core|ports|adapters`), playground (CLI + visual bench), SPEC.md, and `skills/steer-ui/`. This file remains as the distillation record and the canonical list of UI/UX decisions and gotchas (SPEC.md §8 points here).

For the next agent. Andrés has approved graduating this toy into a real onc9 primitive via `primitive-constructor`. Everything below is what you need to not re-learn this project from scratch. Read `~/onc9-systems/primitives/PRIMITIVES.md` before starting; this repo is the distilled ancestor.

## What this is

An agent-first component workshop: the "Storybook for the agentic era." Core thesis, in one line: **the hand-authored story file should not exist**. Everything is either derived from source or captured as data, and every state has a URL. Open source, MIT, explicitly non-commercial; the repo-is-the-database architecture is the product, not a funnel to a hosted tier.

The five verbs an agent needs, which the whole design serves: enumerate (manifest), render (state-addressable in-app route), perceive (Playwright against stable URLs plus `data-steer-*` attributes), diff (import graph scopes what to re-screenshot), author (fixtures and notes as JSON).

- Repo: `github.com/andresCamp/steer-ui` (Andrés's personal account, not onc9-systems)
- Local: `~/onc9-systems/steer-ui`
- Run: `pnpm install && pnpm dev` → app at `localhost:5199`, steer-ui at `/__steer`
- Stack: Solid + Vite 6 + Tailwind v4 + lucide-solid (only icon dep)

## Architecture map

- `tooling/steer-ui-plugin.ts`: the substance. TS AST extraction (components, props, JSDoc), usage scan (app + intra-library tagged `internal`), manifest generation on every source change, and the notes HTTP API as Vite dev middleware. Also `handleHotUpdate` suppression for `.steer/` (see gotchas).
- `src/steer/data.ts`: client contract. Registry (recursive glob, multi-export, compound resolution), fixture types with `$component` refs, `coerceProps`, `stateUrl`, notes API client, `selectorWithin`.
- `src/steer/SteerIndex.tsx`: specimen-sheet library (no cards; live components on hairline rows; per-state comment count badges).
- `src/steer/SteerComponent.tsx`: the canvas page. Pan/zoom world, tick-tape zoom rail, glass chrome, knobs panel, notes layer (pins, regions, threads).
- `.steer/fixtures/*.json`: the only quasi-authored artifact; named states as data.
- `.steer/notes/*.json`: human+agent feedback, committed to git deliberately (notes travel with branches; resolution rides fix commits).
- `.steer/manifest.json`: derived, gitignored, never authored.

## The contract (this is the primitive; guard it)

1. **Manifest**: components with `name`, `slug`, `file`, `props` (kind: enum/boolean/string/number/children/unsupported, with `options`, `numeric`, JSDoc `description`), `usages` (file:line, `internal` flag), `target` for compounds, top-level `warnings`. Served at `GET /__steer/api/manifest`.
2. **State URL grammar**: `/__steer/<slug>?prop=value&...`. Every knob configuration is addressable. Composed children serialize as JSON strings in the query.
3. **Fixtures**: `{ states: { name: { prop: value } } }` where value is a string or a nestable `{ "$component": "Name", "props": {...}, "children": ... }` ref. This beats Storybook's hard limitation (JSX children cannot be URL/controls-serialized there).
4. **Notes**: `{ id, component, stateUrl, selector, coords, rect?, text, author, status, created, replies[] }`. Coords/rect are stage-relative fractions and may exceed 0..1 (canvas notes). API: GET/POST `/__steer/api/notes/<slug>`, POST `.../move`, `.../resolve`, `.../reply`.
5. **Agent protocol** (drafted in README "Agent protocol" section): read open notes before touching a component, reproduce via `stateUrl`, reply as `author: "agent"` (renders indigo), resolve only what you fixed in the same change. Notes scoping is hybrid: pins render full in their own state, dimmed elsewhere; clicking a dim pin navigates to its state.

## Hard-won gotchas (each cost real debugging)

- **solid-refresh HMR wrappers hide expando properties in dev.** `Card.Actions = CardActions` works in prod, silently missing in dev. Hence: compound targets must be named exports, manifest carries `target`, and `resolveComponent` tries dotted name → property access → `BaseSub` export → target. Do not simplify this chain.
- **Vite full-reloads on writes to files outside the module graph.** Every note write reloaded the page until `handleHotUpdate` returns `[]` for `.steer/` paths. Any port to another bundler needs the equivalent.
- **Suspense + refetch = phantom page refresh.** All note mutations use `mutate` (optimistic), never `refetch`; a refetch re-triggers the page-level Suspense and remounts the canvas.
- **Layout shift causes hover flicker.** The zoom percentage/reset swap needs fixed width (see `~/.claude/rules/design.md`; it applies to steer-ui chrome too).
- **Wheel handlers fight.** Canvas wheel pans; the panel and zoom tape each stop propagation and own their wheel. Any new floating chrome that scrolls must do the same.
- **In note mode, existing pins are inert** so clicks fall through to place new notes. Preserve when touching the notes layer.

## UI/UX decisions Andrés locked (do not regress)

Apple/Linear register: liquid-glass chrome (frost + rim light recipe in `app.css .glass`), squircle corners where supported, 16px minimum type everywhere in steer-ui chrome, system SF + SF Mono. Specimen-sheet library, not cards. Canvas: drag to pan, pinch/tape to zoom (log scale), dots grid only visible while navigating and scaled with zoom (world-space, size perspective), zoom rail is a tick tape with fixed cursor. Notes: ghost pin preview replaces cursor in note mode, drag draws a region, region pins anchor to the region's top-right corner, regions drag/resize with their pin, popovers open above the pin, click-outside closes, `c` hotkey arms note mode, threaded replies with compact relative timestamps. Bottom pill reads "Add note" with a custom glass tooltip carrying the keycap.

## The build ahead

Skill verbs agreed with Andrés:

- **install**: detect host stack; adapt and wire plugin + steer-ui route + `.steer/` scaffold + CLAUDE.md injection (steer-ui-is-truth, verify-after-edit, notes protocol). Idempotent; ends by generating the manifest and opening `/__steer`.
- **uninstall**: full clean removal (plugin, route, config, CLAUDE.md block, dep if orphaned). Open notes are human feedback: surface them and offer archive vs delete, never silently destroy.
- **work**: the agent protocol above, as the default mode when steer-ui is already installed. steer-ui is the unit test; real app flows via Playwright remain the integration test. steer-ui must never hijack flow-level verification (Andrés was explicit).
- **doctor**: a shipped script with deterministic checks (plugin wired, manifest fresh and answering, fixtures parse, note stateUrls resolve) + agent judgment for repairs. `work` runs it as a precondition.

Framework portability: the contract above is framework-neutral. Extraction works for React TSX as-is; Svelte/Vue need their own extractors (compiler APIs). The steer-ui UI must be written per host framework; the registry/Dynamic glue is ~40 lines per framework. Non-Vite hosts swap the plugin for equivalent route handlers.

Known limits, consciously deferred: imported/intersection prop types (needs real type-checker extraction, the right upgrade for the primitive), popover viewport clamping (flip below when no headroom), live-ticking timestamps, realtime multi-human sync (files are single-machine by design).

## Working notes for the next agent

- A PreToolUse gate blocks Solid-pattern writes until context7 is queried for the specific pattern; it re-arms per pattern, not per session. Query `/websites/solidjs` (or solid-router) for whatever you are about to write, then retry.
- prose-lint hook rejects em dashes in .md/.html writes.
- The dev server dies when sessions end; restart with `pnpm dev` before browser verification, and verify every feature in the real browser via Playwright MCP. That discipline caught the HMR and reload bugs; keep it.
- Andrés reviews by feel and screenshots, gives sharp short feedback, and prefers action over discussion ("why are we talking, let's just do it"). Flag a real risk once, then build.
