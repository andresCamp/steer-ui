---
name: steer-ui
description: Applies steer-ui, the visual interface for steering coding agents to the last mile of UI, to any project, and operates it where installed. Use when the user asks to "add steer-ui", "install steer-ui", "set up a component workshop/gallery/playground", "a Storybook alternative", "storybook but for agents", "give components addressable states", "let me leave notes on components", "polish my components with the agent", or, in a host where steer-ui is installed, to work on components, check component feedback, or "run steer-ui doctor". Four verbs - install (wire plugin + register entry + scaffold), work (the notes protocol: read, reproduce via stateUrl, fix, reply, resolve), doctor (deterministic health checks), uninstall (clean removal, never silently destroying notes).
---

# steer-ui: apply the component-steering workshop to this project

steer-ui gives a host project a derived component catalog (`/__steer`), state-addressable rendering (`/__steer/<slug>?prop=value`), and feedback-as-data (notes pinned to state URLs, committed to git). The human points at what is off; the agent opens that state, reproduces it, fixes it, and replies. The engine is a tested library at `~/onc9-systems/steer-ui` (the lab). Your job is to instantiate it into the host's stack, then operate it by protocol.

## The one principle that governs every decision

**Everything is derived from source or captured as data; the hand-authored story file must never exist.** If an install step tempts you to author a per-component artifact (a story, a registration list, a config entry per component), you are doing it wrong: the manifest derives it, or a fixture/note captures it. The contract (manifest schema, `/__steer` URL grammar, notes shape, `.steer/` layout) is identical in every host; only extractors, transports, and mounters adapt; the chrome itself is built once and is the same everywhere.

Five invariants are non-negotiable in anything you scaffold (SPEC.md §1 has the full statements):
1. Manifest derived, never authored.
2. Every state addressable as a URL (composed children included).
3. Notes append-preserving; resolution is a status flip, deletion is a human act.
4. Degrade visibly, never crash.
5. Contract framework-neutral. Concretely: the chrome is built once and never compiled by the host, so a framework costs one Mounter plus one Extractor, never another canvas.

## The contract you are instantiating

```
Engine (copy from lab, do not fork logic):
  core/         extraction, manifest, state URLs, note transitions, doctor, engine facade
  ports/        SourceStore+ManifestStore required; FixtureStore+NoteStore optional
  adapters      node-fs (stores), vite (driving: watch, HMR suppression, HTTP API)
Chrome (ONE build, served as an asset, never compiled by the host):
  chrome/       bench.js + bench.css (specimen sheet, canvas, notes layer)
                overlay.js + overlay.css (notes on the host's own pages)
Host-compiled (the only part, ~15 lines):
  mount/<fw>.ts the Mounter: how this framework instantiates a component
  src/steer.ts  publishRegistration({ modules: import.meta.glob(...), mounter })
Data (.steer/, committed except the manifest):
  fixtures/*.json   named states as data
  notes/*.json      feedback pinned to state URLs
  manifest.json     derived; gitignored
HTTP API: GET manifest | GET doctor | GET fixtures/<slug> | GET/POST notes/<slug> (+ /move /reply /resolve)
```

## Workflow

### install

1. **Detect** the host: bundler (Vite? else the standalone server + proxy), framework (which Mounter it needs; Solid, React, Vue and Svelte all exist), component dir, and whether prop types are imported/intersections (turn on `typecheck`). Read `references/install-playbook.md` and follow the stack recipe. Vue and Svelte have Mounters but no SFC extractor yet, so their manifests would come back empty: say so honestly and stop rather than improvising an extractor. Any framework with neither is lab work against `adapters/mount/contract.test.ts`. The overlay needs no Mounter at all, so it can be installed alone in any stack.
2. **Copy** the engine, the host's Mounter, and the built chrome per the playbook (commit-hash comment as drift receipt), wire the plugin into the bundler config, write the register entry, scaffold `.steer/` (gitignore the manifest). Do NOT mount steer-ui in the host router: the plugin serves `/__steer` as its own document.
3. **Inject** the AGENTS.md block (`references/claude-md-block.md`; CLAUDE.md as an alias for Claude Code): steer-ui-is-truth, verify-after-edit, the notes protocol.
4. **Verify**: start dev, `GET /__steer/api/doctor` must pass, open `/__steer` in Playwright and confirm the specimen sheet renders live components. Idempotent: re-running install repairs, never duplicates.

### work (the default verb where steer-ui is installed)

Precondition: run **doctor** first; repair before working. Then the protocol:
- Before touching a component, read its open notes (`.steer/notes/<slug>.json` or the API). Reproduce each via its `stateUrl` in Playwright.
- After changing a component, re-verify its states AND its `internal` usages (the manifest's usage scan tells you what composes it).
- Reply as `author: "agent"` (renders indigo); resolve only what you actually fixed, in the same change as the fix.
- Flag findings as new notes with a precise `stateUrl`.
- steer-ui is the unit test for components. It MUST NOT absorb flow-level verification: real app flows stay with Playwright against the app's own routes.

### doctor

`GET /__steer/api/doctor` (dev server must be up; a dead server is itself the first finding). Checks: manifest fresh vs source, fixtures parse and reference known props, open notes point at existing components. Deterministic checks come from the engine; you supply judgment for repairs (regenerate, fix fixture, flag orphaned notes to the human).

### uninstall

Remove: plugin wiring, the copied engine + mounter + chrome, the register entry, the AGENTS.md block, and the `.steer/` scaffold. No orphaned deps to chase: the chrome bundles its own. **Open notes are human feedback: list them, offer archive (move to `docs/steer-ui-notes-archive/`) vs delete, never silently destroy.**

## Promote back

Anything you build in a host that the lab lacks (a Vue or Svelte Mounter, a Next driving adapter, a better extractor) gets generalized, tested in the lab (`~/onc9-systems/steer-ui`), and recorded in `references/portability.md`. The human gates what enters the canon. Route via the `onc9-primitives` skill.
