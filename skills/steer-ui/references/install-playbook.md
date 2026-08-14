# Install playbook

Stack recipes for instantiating steer-ui into a host. The lab is `~/onc9-systems/steer-ui`; record the lab commit hash in a comment at the top of every copied file (`// steer-ui <hash> - copied from the lab; promote fixes back`).

## Detection checklist

- Bundler: `vite.config.*` present? Vite gets the plugin; anything else gets the standalone server + proxy (below).
- Framework: which Mounter does the host need? Solid, React, Vue and Svelte all ship one, and the bench is the same prebuilt chrome for every host. Vue and Svelte hosts still lack an SFC extractor, so the manifest would be empty: install the overlay if useful, and be honest that the bench needs the extractor first.
- Component dir: where do reusable components live? (`src/components` default; anything else becomes the `componentDir` option.)
- Router: nothing to add. The chrome bundles its own router and owns the `/__steer` document; it never touches the host's routing.
- Styling: nothing to do. The chrome ships its own CSS, and the overlay's stylesheet deliberately omits Tailwind preflight so it cannot reset the host app's styles. The host's own stylesheet is loaded into the bench document so host components look the way they do in the app.
- Icons: nothing to install. They are bundled into the chrome.
- Prop types imported from other modules or built from intersections? Turn on `typecheck: true` (costs a TS program per regeneration; worth it whenever knobs come back `unsupported`).

## Recipe: Vite host (Solid or React)

There is no surface to copy any more. The bench and the overlay are prebuilt
assets the plugin serves; the host compiles its component glob and one Mounter.

1. **Copy the engine** to `tooling/steer-ui/`:
   - `src/core/*` -> `tooling/steer-ui/core/`
   - `src/ports/index.ts` -> `tooling/steer-ui/ports/index.ts`
   - `src/adapters/{node-fs.ts,http.ts,vite.ts,client.ts}` -> `tooling/steer-ui/`
   - `src/adapters/mount/<framework>.ts` -> `tooling/steer-ui/mount/`
   - `dist/chrome/*` -> `tooling/steer-ui/chrome/` (built artifacts, not source)
   - Fix relative imports in the adapters: `../core/...` and `../ports` become `./core/...` and `./ports`.
2. **Register entry** at `src/steer.ts`. This is the ONLY host-compiled part.
   Adjust the glob to the host's component dir and the author to the human's name:
   ```ts
   import { publishRegistration } from "../tooling/steer-ui/core/bridge"
   import { solidMounter } from "../tooling/steer-ui/mount/solid"

   publishRegistration(globalThis, {
     modules: import.meta.glob("./components/**/*.tsx", { eager: true }) as Record<
       string,
       Record<string, unknown>
     >,
     mounter: solidMounter,
     author: "<human>",
   })
   ```
3. **Wire the plugin** in `vite.config.ts` (the export is `steer`):
   ```ts
   import { steer } from "./tooling/steer-ui/vite"
   plugins: [/* framework plugin */, tailwindcss(), steer({ componentDir: "src/components", typecheck: true })]
   ```
4. **Do not mount steer-ui in the host router or App.** The plugin is `apply: "serve"`: it injects the overlay as a prebuilt script via `transformIndexHtml` and serves `/__steer` as its own HTML entry. `src/steer.ts` is imported only by that virtual host entry. If a host file imports it directly, it will ship. That is a bug.
5. **Scaffold `.steer/`**: create `fixtures/` and `notes/` (empty is fine), append `.steer/manifest.json` (path-adjusted) to `.gitignore`.
6. **AGENTS.md**: inject the block from `claude-md-block.md` (CLAUDE.md as an alias for Claude Code).
7. **Verify**: dev server up; `curl /__steer/api/doctor` passes; Playwright renders `/__steer`; create + resolve a scratch note via the API; delete the scratch file.

Idempotency: every step checks before writing (file exists with drift receipt -> compare, refresh if the lab moved; config lines present -> skip; CLAUDE block present -> replace between markers).

## Recipe: non-Vite host (Next, webpack, express)

The engine runs as a standalone API server and the host proxies to it. The bench
is the same prebuilt chrome, served as static files, so there is no surface to
port and no Solid in the host's build.

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
4. Serve the chrome. Copy `tooling/steer-ui/chrome/*` to the host's static
   directory (Next: `public/__steer/chrome/`), so `bench.js`, `bench.css`,
   `overlay.js` and `overlay.css` are reachable at `/__steer/chrome/`.
5. Serve the bench document at `/__steer/*`. It is a static HTML page with three
   tags: the chrome stylesheet, the host's register entry, and the chrome
   script. Load order does not matter, the bridge queues whichever lands first.
6. Inject the overlay into the host's app pages in dev: a `<link>` for
   `overlay.css` and a `<script type="module">` for `overlay.js`. No framework
   code enters the host build; the overlay only reads the rendered DOM.
7. The register entry is compiled by the host. Next has no `import.meta.glob`,
   so use `require.context` or generate the component map at dev-server start.
8. `.steer/` scaffold, AGENTS.md, and verification are identical to the Vite recipe.

Steps 4 to 7 have NOT been exercised against a real Next host yet; expect to
promote fixes back. What has changed is that the hard part is gone: the bench no
longer has to be ported to the host's framework.

## Recipe gaps (be honest, do not improvise at install time)

- **Svelte / Vue hosts**: the Mounters exist and are contract-tested. What is missing is the extractor: `.vue` and `.svelte` sources yield no components, so the manifest comes back empty. That is lab work (`vue-component-meta`, or `svelte2tsx` into the checked extractor), not install-time improvisation.
- **Overlay-only installs**: the overlay needs no Mounter at all (it reads the host's rendered DOM), so a host with no Mounter yet can still get the live app view and page notes.

## Uninstall (mirror of install)

Remove in reverse order: register entry `src/steer.ts`, plugin/server wiring, `tooling/steer-ui/` (engine, mount, chrome), `.gitignore` line, AGENTS.md/CLAUDE.md block (between its markers). There are no orphaned deps to clean up: the chrome bundles its own. Then handle `.steer/`: fixtures are cheap to delete with the human's nod; **open notes are feedback: enumerate them with text + author, offer archive to `docs/steer-ui-notes-archive/` vs delete, and default to archive.**
