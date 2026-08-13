# Install playbook

Stack recipes for instantiating steer-ui into a host. The lab is `~/onc9-systems/steer-ui`; record the lab commit hash in a comment at the top of every copied file (`// steer-ui <hash> - copied from the lab; promote fixes back`).

## Detection checklist

- Bundler: `vite.config.*` present? Vite gets the plugin; anything else gets the standalone server + proxy (below).
- Framework: `solid-js` or `react` in deps? Both have full render surfaces. Svelte/Vue do not (lab work; be honest and stop).
- Component dir: where do reusable components live? (`src/components` default; anything else becomes the `componentDir` option.)
- Router: the Solid surface needs `@solidjs/router`; the React surface needs `react-router` v7 (`useParams`/`useSearchParams`/`Link` from the `react-router` package).
- Styling: Tailwind v4? The surfaces use Tailwind classes plus small CSS blocks (`.glass`, `.smooth-corners`, `.canvas-dots`, `.rise-in`). Without Tailwind the UI functions but loses its register; say so and let the human decide.
- Icons: `lucide-solid` or `lucide-react` (7 icons). Install or accept.
- Prop types imported from other modules or built from intersections? Turn on `typecheck: true` (costs a TS program per regeneration; worth it whenever knobs come back `unsupported`).

## Recipe: Vite host (Solid or React)

1. **Copy the engine** to `tooling/steer-ui/`:
   - `src/core/*` -> `tooling/steer-ui/core/`
   - `src/ports/index.ts` -> `tooling/steer-ui/ports/index.ts`
   - `src/adapters/{node-fs.ts,http.ts,vite.ts}` -> `tooling/steer-ui/`
   - Fix relative imports in the adapters: `../core/...` and `../ports` become `./core/...` and `./ports`.
2. **Copy the surface** to `src/steer/`:
   - Solid: `src/adapters/client.ts` + `src/adapters/solid/{data.ts,SteerIndex.tsx,SteerComponent.tsx}` -> `src/steer/`
   - React: `src/adapters/client.ts` + `src/adapters/react/{data.ts,SteerIndex.tsx,SteerComponent.tsx}` -> `src/steer/`
   - Fix data.ts imports: `../../core/...` -> `../../tooling/steer-ui/core/...`; `../client` -> `./client`.
3. **Registry glue** at `src/steer/register.ts` (adjust the glob to the host's component dir, author to the human's name):
   ```ts
   import { registerComponents } from "./data"
   registerComponents(import.meta.glob("../components/**/*.tsx", { eager: true }) as Record<
     string,
     Record<string, unknown>
   >, { author: "<human>" })
   ```
4. **Wire the plugin** in `vite.config.ts`:
   ```ts
   import { steer-ui } from "./tooling/steer-ui/vite"
   plugins: [/* framework plugin */, tailwindcss(), steer({ componentDir: "src/components", typecheck: true })]
   ```
   Pass `excludeDirs: ["src/steer"]` only if the surface lives elsewhere (that value is the default).
5. **Do not mount steer-ui in the host router or App.** The plugin is `apply: "serve"`: it injects the overlay via `transformIndexHtml` and serves `/__steer` as its own HTML entry. The register module (`src/steer.ts`) is imported only by that virtual bench entry. If a host file imports `src/steer` or `SteerIndex`, it will ship. That is a bug.
6. **Tailwind sources**: if the surface files live outside Tailwind's auto-detected content, add `@source "<relative path>";` after `@import "tailwindcss";`. Copy the `.glass`, `.smooth-corners`, `.canvas-dots`, `.rise-in` blocks from the lab's `playground/app/src/app.css`.
7. **Scaffold `.steer/`**: create `fixtures/` and `notes/` (empty is fine), append `.steer/manifest.json` (path-adjusted) to `.gitignore`.
8. **CLAUDE.md**: inject the block from `claude-md-block.md`.
9. **Verify**: dev server up; `curl /__steer/api/doctor` passes; Playwright renders `/__steer`; create + resolve a scratch note via the API; delete the scratch file.

Idempotency: every step checks before writing (file exists with drift receipt -> compare, refresh if the lab moved; config lines present -> skip; CLAUDE block present -> replace between markers).

## Recipe: non-Vite host (Next, webpack, express)

The engine runs as a standalone API server; the host proxies to it and mounts the React surface on its own routes.

1. Copy the engine as above, but take `node-server.ts` instead of `vite.ts`.
2. Run it alongside dev (a `steer-ui:api` script): 
   ```ts
   import { createSteerServer } from "./tooling/steer-ui/node-server"
   const { listen } = createSteerServer({ root: process.cwd(), port: 5199, typecheck: true })
   listen()
   ```
   No watcher needed: manifest and doctor regenerate on every read.
3. Proxy `/__steer/api/*` to it:
   - Next (`next.config`): `rewrites: [{ source: "/__steer/api/:path*", destination: "http://localhost:5199/__steer/api/:path*" }]`
   - express: `http-proxy-middleware` on the same path.
4. Mount the React surface: Next app router gets a client page at `app/__steer/[[...slug]]/page.tsx` that renders SteerIndex/SteerComponent from the copied surface (the surface uses react-router hooks; in Next, wrap with a MemoryRouter synced to the pathname, or mount the surface in a tiny standalone Vite app if the host prefers isolation). This mapping has NOT been exercised against a real Next host yet; expect to promote fixes back.
5. `.steer/` scaffold, CLAUDE.md, and verification are identical to the Vite recipe.

## Recipe gaps (be honest, do not improvise at install time)

- **Svelte / Vue hosts**: need their own extractors (compiler APIs) and surfaces. Lab work; propose it, build it in the lab with its own playground app, then install.

## Uninstall (mirror of install)

Remove in reverse order: routes + register import, `src/steer/`, plugin/server wiring, `tooling/steer-ui/`, `.gitignore` line, CLAUDE.md block (between its markers), orphaned deps (`lucide-*` if nothing else imports them). Then handle `.steer/`: fixtures are cheap to delete with the human's nod; **open notes are feedback: enumerate them with text + author, offer archive to `docs/steer-ui-notes-archive/` vs delete, and default to archive.**
