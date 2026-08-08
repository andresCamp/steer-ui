# bench

Open source (MIT). An agent-first component workshop: the "Storybook for the agentic era." The thesis: Storybook's core artifact, the hand-authored story file, should not exist. Everything here is derived from source or captured as data, and every state has a URL.

Built as an [onc9 primitive](SPEC.md): a pure hexagonal engine (`src/`), an offline deterministic bench (`playground/`), and an agent skill (`skills/bench/`) that installs it into host projects.

## The five verbs (what an agent gets)

- **enumerate**: `GET /__bench/api/manifest`, regenerated from TypeScript source on every change (props from `<Name>Props` declarations, JSDoc descriptions, usage sites with `internal` tagging).
- **render**: `/__bench/<slug>?prop=value`. Every knob configuration is addressable and shareable, including composed children (`{"$component": ...}` refs serialized in the URL, which Storybook cannot do).
- **perceive**: Playwright against stable state URLs and `data-bench-*` attributes.
- **diff**: the usage scan scopes what to re-verify when a component changes.
- **author**: fixtures (`.bench/fixtures/*.json`, named states as data) and notes (`.bench/notes/*.json`, feedback pinned to state URLs, committed to git so it travels with branches).

## Run

```
pnpm install
pnpm dev        # Solid visual bench: app at :5199, bench at /__bench
pnpm dev:react  # React visual bench: same thing at :5299
pnpm playground # CLI bench: the full engine loop, offline and deterministic
pnpm test       # invariant-pinned tests
pnpm check-types
```

## Layout

```
src/core        pure engine: extraction (syntactic + type-checked), manifest,
                state URLs, notes, doctor
src/ports       the contract; SourceStore+ManifestStore required, rest optional
src/adapters    memory, node-fs, http (shared routes), vite + node-server
                (driving), client (shared), solid/ + react/ (render surfaces)
playground      CLI bench + Solid and React host apps as visual benches
skills/bench    the agent front door: install / work / doctor / uninstall
```

Imported or intersection prop types? Turn on `bench({ typecheck: true })` and the manifest resolves them through the TypeScript checker instead of marking them unsupported. Non-Vite dev server? `createBenchServer` runs the same API standalone; the host proxies `/__bench/api/*`.

## Agent protocol (notes)

No special tooling: notes are JSON files plus a local HTTP API, both already agent-accessible.

- Read notes: `.bench/notes/<slug>.json` (or `GET /__bench/api/notes/<slug>`). Each note has `stateUrl` (open it to reproduce), `selector`, `coords`/`rect` (stage-relative), `status`, and `replies`.
- Before and after working on a component, check its open notes. Reproduce via `stateUrl` with Playwright.
- Reply to a note: `POST /__bench/api/notes/<slug>/reply` with `{ "id", "text", "author": "agent" }`.
- Create a note: `POST /__bench/api/notes/<slug>` with `{ "stateUrl", "selector", "coords", "text", "author": "agent" }`.
- Resolve only what you actually fixed: `POST /__bench/api/notes/<slug>/resolve` with `{ "id" }`, in the same change as the fix.
- Health check everything: `GET /__bench/api/doctor`.

Agent-authored notes and replies render with indigo accents so authorship is visible at a glance.

## Conventions the codegen expects

- Components live anywhere under `src/components/` (nested folders fine). Every exported capitalized function in a file is a component, so subcomponent files (Card + CardHeader) work.
- Compound components work via both idioms: expando assignment (`Card.Actions = CardActions`) and `export const Toolbar = Object.assign(ToolbarRoot, { Spacer: ToolbarSpacer })`. Targets should also be named exports (dev-mode HMR wrappers hide runtime properties; the manifest records the target name as a fallback). The manifest lists only the dotted name; usage scan matches `<Card.Actions`.
- Component names must be unique across the library. Duplicates get de-collided slugs and a `warnings` entry in the manifest.
- Props declared as `interface <Name>Props` (or type alias with a type literal) in the same file as the component.
- Enum knobs come from string or numeric literal unions. Imported prop types and computed types show as unsupported (visible in the manifest, no knob): the same graceful-degradation stance as react-docgen.
- The usage scan covers the app AND the library itself; intra-library usages are tagged `internal` (impact analysis: edit Button, re-verify Card).

## Spec

`SPEC.md` (arc42). Where the spec and the code disagree, the code wins.
