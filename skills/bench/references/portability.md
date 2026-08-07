# Portability map (the adapter catalog)

What exists, what is a named gap. Promote host-built pieces back to the lab via the `onc9-primitives` skill; nothing enters this list without a lab test and a playground exercise.

## Extractors (source -> component specs)

| Language surface | Status |
|---|---|
| TypeScript TSX (`interface <Name>Props`, type-literal aliases, string/numeric literal unions, JSDoc, expando + Object.assign compounds) | **Built + tested** (`core/extract.ts`) |
| Imported / intersection / computed prop types | Named gap: degrade to `unsupported` today; the upgrade is optional type-checker extraction behind the same `SourceFile[] -> specs` seam |
| Svelte / Vue SFCs | Named gap: compiler-API extractors |

## Driving adapters (dev-server transport)

| Transport | Status |
|---|---|
| Vite plugin (watch + `.bench/` HMR suppression + HTTP API) | **Built** (`adapters/vite.ts`); HMR suppression is load-bearing, any port must replicate it |
| Next / webpack / raw express | Named gap |

## Render surfaces

| Framework | Status |
|---|---|
| Solid (specimen sheet + canvas + notes layer) | **Built + browser-verified** (`adapters/solid/`) |
| React | Named gap: port the 3 surface files; registry glue stays ~10 lines |

## Stores

| Store | Status |
|---|---|
| node-fs over `.bench/` | **Built** |
| memory (bench/test fuel) | **Built** |

## Hosts applied

| Host | Notes |
|---|---|
| (none yet) | First application should pressure-test install + work + doctor + uninstall and feed corrections back into the playbooks |
