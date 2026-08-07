# bench

Open source (MIT). Toy prototype of an agent-first component workshop. The thesis: Storybook's core artifact (the hand-authored story file) should not exist. Everything here is derived from source or captured as data.

## What it does

- `tooling/bench-plugin.ts` regenerates `.bench/manifest.json` on every source change: components from `src/components/`, prop knobs from their `<Name>Props` TypeScript declarations (enums, booleans, strings, numbers, JSDoc descriptions), usage sites from a scan of the rest of `src/`.
- `/__bench` renders the gallery from the manifest. `/__bench/:slug` renders one component with knobs; every knob configuration serializes to the URL, so any state is addressable and shareable.
- Fixtures (`.bench/fixtures/*.json`) are the only quasi-authored artifact: named states as plain data.
- Notes: toggle "+ note", click the rendered component, type. The pin captures the state URL, a DOM selector, fractional coordinates, and your text into `.bench/notes/<slug>.json`, which is what an agent reads.
- Playwright surface: stable state URLs, `GET /__bench/api/manifest`, and `data-bench-*` attributes throughout.

## Run

```
pnpm install
pnpm dev
```

App at http://localhost:5199, bench at http://localhost:5199/__bench.

## Agent protocol (notes)

No special tooling: notes are JSON files plus a local HTTP API, both already agent-accessible. The eventual skill md carries these lines:

- Read notes: `.bench/notes/<slug>.json` (or `GET /__bench/api/notes/<slug>`). Each note has `stateUrl` (open it to reproduce), `selector`, `coords`/`rect` (stage-relative), `status`, and `replies`.
- Before and after working on a component, check its open notes. Reproduce via `stateUrl` with Playwright.
- Reply to a note (ask a question, report what you changed): `POST /__bench/api/notes/<slug>/reply` with `{ "id", "text", "author": "agent" }`.
- Create a note (flag something you found): `POST /__bench/api/notes/<slug>` with `{ "stateUrl", "selector", "coords", "text", "author": "agent" }`.
- Resolve only what you actually fixed: `POST /__bench/api/notes/<slug>/resolve` with `{ "id" }`, in the same change as the fix.

Agent-authored notes and replies render with indigo accents in the bench so authorship is visible at a glance.

## Conventions the codegen expects

- Components live anywhere under `src/components/` (nested folders fine). Every exported capitalized function in a file is a component, so subcomponent files (Card + CardHeader) work.
- Compound components work via both idioms: expando assignment (`Card.Actions = CardActions`) and `export const Toolbar = Object.assign(ToolbarRoot, { Spacer: ToolbarSpacer })`. Targets should also be named exports (dev-mode HMR wrappers hide runtime properties, so the export is the reliable render path; the manifest records the target name as a fallback). The manifest lists only the dotted name, absorbing the standalone target and the root; usage scan matches `<Card.Actions`. An `Object.assign` base without its own `<Name>Props` takes props from its root function's declaration.
- Component names must be unique across the library. Duplicates get de-collided slugs and a `warnings` entry in the manifest.
- Props declared as `interface <Name>Props` (or type alias with a type literal) in the same file as the component.
- Enum knobs come from string or numeric literal unions. Imported prop types and computed types show as unsupported (visible in the manifest, no knob): the same graceful-degradation stance as react-docgen.
- Composition: fixture values can be component references, `{ "$component": "Button", "props": {...}, "children": "..." }`, nestable. References serialize to JSON strings in the state URL, so composed states stay addressable and shareable (Storybook cannot URL-serialize JSX children at all; this is the workaround made first-class).
- Usage scan covers the app AND the library itself; intra-library usages are tagged `internal` (impact analysis: edit Button, re-verify Card).
