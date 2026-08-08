# Portability map (the adapter catalog)

What exists, what is a named gap. Promote host-built pieces back to the lab via the `onc9-primitives` skill; nothing enters this list without a lab test and a playground exercise.

## Extractors (source -> component specs)

| Language surface | Status |
|---|---|
| TypeScript TSX, syntactic (`interface <Name>Props`, type-literal aliases, string/numeric literal unions, JSDoc, expando + Object.assign compounds) | **Built + tested** (`core/extract.ts`) |
| Imported / aliased / intersection Props types | **Built + tested** (`core/extract-checked.ts`, opt-in `typecheck: true`; resolves through the TS checker over a virtual program; unresolvable falls back to syntactic) |
| Svelte / Vue SFCs | Named gap: compiler-API extractors behind the same `SourceFile[] -> specs` seam |

## Driving adapters (dev-server transport)

| Transport | Status |
|---|---|
| Vite plugin (watch + `.bench/` HMR suppression + shared HTTP handler) | **Built + browser-verified** (`adapters/vite.ts`) |
| Standalone node server (`adapters/node-server.ts`): framework-neutral API server, regenerate-on-read, host proxies `/__bench/api/*` | **Built + HTTP-tested**; recipes for Next rewrites / express proxy in the install playbook; not yet exercised against a real Next host |
| Shared route table (`adapters/http.ts`) | **Built**; any node transport mounts it |

## Render surfaces

| Framework | Status |
|---|---|
| Solid (specimen sheet + canvas + notes layer) | **Built + browser-verified** (`adapters/solid/`, exercised by `playground/app`) |
| React 19 + react-router 7 (full-parity port) | **Built + browser-verified** (`adapters/react/`, exercised by `playground/react-app`) |
| Svelte / Vue | Named gap: surfaces do not exist; keep both ports in lockstep when the canvas evolves |

## Stores

| Store | Status |
|---|---|
| node-fs over `.bench/` | **Built** |
| memory (bench/test fuel) | **Built** |

## Hosts applied

| Host | Notes |
|---|---|
| (none yet) | First application should pressure-test install + work + doctor + uninstall and feed corrections back into the playbooks |
