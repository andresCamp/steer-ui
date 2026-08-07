# Install playbook

Stack recipes for instantiating bench into a host. The lab is `~/onc9-systems/bench`; record the lab commit hash in a comment at the top of every copied file (`// bench <hash> - copied from the lab; promote fixes back`).

## Detection checklist

- Bundler: `vite.config.*` present? (Only Vite has a driving adapter today.)
- Framework: `solid-js` in deps? React? (Only Solid has a render surface today.)
- Component dir: where do reusable components live? (`src/components` default; anything else becomes the `componentDir` option.)
- Router: `@solidjs/router` present? The bench routes need it (install if absent, it is dev-convenient and tiny).
- Styling: Tailwind v4? The reference UI uses Tailwind classes plus a small `.glass` CSS block. Without Tailwind, the UI still functions but loses its register; say so and let the human decide.
- Icons: the canvas uses `lucide-solid` (7 icons). Install or accept.

## Recipe: Vite + Solid (the reference)

1. **Copy the engine** to `tooling/bench/`:
   - `src/core/*` -> `tooling/bench/core/`
   - `src/ports/index.ts` -> `tooling/bench/ports/index.ts`
   - `src/adapters/node-fs.ts`, `src/adapters/vite.ts` -> `tooling/bench/`
   - Fix relative imports in the two adapters: `../core/...` and `../ports` become `./core/...` and `./ports`.
2. **Copy the surface** to `src/bench/`:
   - `src/adapters/solid/{data.ts,BenchIndex.tsx,BenchComponent.tsx}` -> `src/bench/`
   - Fix data.ts imports: `../../core/...` -> `../../tooling/bench/core/...`
3. **Registry glue** at `src/bench/register.ts` (adjust the glob to the host's component dir, author to the human's name):
   ```ts
   import { registerComponents } from "./data"
   registerComponents(import.meta.glob("../components/**/*.tsx", { eager: true }) as Record<
     string,
     Record<string, unknown>
   >, { author: "<human>" })
   ```
4. **Wire the plugin** in `vite.config.ts`:
   ```ts
   import { bench } from "./tooling/bench/vite"
   plugins: [solid(), tailwindcss(), bench({ componentDir: "src/components" })]
   ```
   Pass `excludeDirs: ["src/bench"]` only if the surface lives elsewhere (that value is the default).
5. **Mount routes** in the app entry (import the register module for its side effect first):
   ```tsx
   import "./bench/register"
   import { BenchIndex } from "./bench/BenchIndex"
   import { BenchComponent } from "./bench/BenchComponent"
   <Route path="/__bench" component={BenchIndex} />
   <Route path="/__bench/:slug" component={BenchComponent} />
   ```
   Dev-only mounting (wrap in `import.meta.env.DEV`) is correct for hosts that ship this entry to production.
6. **Tailwind sources**: if the surface files live outside Tailwind's auto-detected content (monorepos), add `@source "<relative path to src/bench>";` after `@import "tailwindcss";`. Also copy the `.glass`, `.smooth-corners`, `.canvas-dots`, `.rise-in` blocks from the lab's `playground/app/src/app.css` into the host stylesheet.
7. **Scaffold `.bench/`**: create `fixtures/` and `notes/` (empty is fine), append `.bench/manifest.json` (path-adjusted) to `.gitignore`.
8. **CLAUDE.md**: inject the block from `claude-md-block.md`.
9. **Verify**: `pnpm dev`; `curl /__bench/api/doctor` passes; Playwright renders `/__bench`; create + resolve a scratch note via the API; delete the scratch file.

Idempotency: every step checks before writing (file exists with drift receipt -> compare, refresh if the lab moved; config lines present -> skip; CLAUDE block present -> replace between markers).

## Recipe gaps (be honest, do not improvise at install time)

- **React host**: extraction works as-is (TSX). The render surface and registry glue must be ported (~the same 3 files; `Dynamic` -> render prop, resource -> SWR/query of choice). That is lab work; propose it, build it in the lab with its own playground app, then install.
- **Svelte/Vue**: need their own extractors (compiler APIs) behind the same `SourceFile[] -> specs` seam. Lab work.
- **Non-Vite dev servers**: replace `vite.ts` with an equivalent (watch + HMR-suppression + middleware). Lab work.

## Uninstall (mirror of install)

Remove in reverse order: routes + register import, `src/bench/`, plugin wiring, `tooling/bench/`, `.gitignore` line, CLAUDE.md block (between its markers), orphaned deps (`lucide-solid` if nothing else imports it). Then handle `.bench/`: fixtures are cheap to delete with the human's nod; **open notes are feedback: enumerate them with text + author, offer archive to `docs/bench-notes-archive/` vs delete, and default to archive.**
