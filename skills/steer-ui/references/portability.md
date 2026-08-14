# Portability map (the adapter catalog)

What exists, what is a named gap. Promote host-built pieces back to the lab via the `onc9-primitives` skill; nothing enters this list without a lab test and a playground exercise.

## Extractors (source -> component specs)

| Language surface | Status |
|---|---|
| TypeScript TSX, syntactic (`interface <Name>Props`, type-literal aliases, string/numeric literal unions, JSDoc, expando + Object.assign compounds) | **Built + tested** (`core/extract.ts`) |
| Imported / aliased / intersection Props types | **Built + tested** (`core/extract-checked.ts`, opt-in `typecheck: true`; resolves through the TS checker over a virtual program; unresolvable falls back to syntactic) |
| Svelte / Vue SFCs | Named gap: compiler-API extractors behind the same `SourceFile[] -> specs` seam. Vue has `vue-component-meta` (official, vuejs/language-tools); Svelte can route through `svelte2tsx` and reuse the checked extractor |

## Driving adapters (dev-server transport)

| Transport | Status |
|---|---|
| Vite plugin (watch + `.steer/` HMR suppression + shared HTTP handler + serves the prebuilt chrome) | **Built + browser-verified** (`adapters/vite.ts`) |
| Standalone node server (`adapters/node-server.ts`): framework-neutral API server, regenerate-on-read, host proxies `/__steer/api/*` | **Built + HTTP-tested**; recipes for Next rewrites / express proxy in the install playbook; not yet exercised against a real Next host |
| Shared route table (`adapters/http.ts`) | **Built**; any node transport mounts it |

## Render surface

There is ONE surface. The chrome (specimen sheet, canvas, notes layer, overlay)
is built once from `adapters/chrome/` and ships as a prebuilt asset the host
serves but never compiles. A framework is not a surface: it is a Mounter plus
an Extractor.

| Piece | Status |
|---|---|
| Chrome, built to `dist/chrome/{bench,overlay}.{js,css}` | **Built + browser-verified** against both a Solid host and a React host |
| Overlay as a standalone asset (no Mounter, reads the host's rendered DOM) | **Built**; works in any stack, including ones with no Mounter yet |

The React surface was deleted. It was a 1267 line duplicate of the Solid canvas
that had already fallen out of lockstep (no overlay at all, and the plugin gated
overlay injection on `surface === "solid"`).

## Mounters (host framework -> a mounted component)

One small file per framework, pinned by one shared contract suite
(`adapters/mount/contract.test.ts`). If a framework passes those invariants the
bench can drive it.

| Framework | Status |
|---|---|
| Solid (`adapters/mount/solid.ts`, ~60 loc) | **Built + contract-tested + browser-verified** |
| React (`adapters/mount/react.ts`, ~40 loc) | **Built + contract-tested + browser-verified** |
| Vue (`h` / `createApp`) | Named gap: write the mounter, add it to CASES |
| Svelte 5 (`mount`) | Named gap: same shape |

## Stores

| Store | Status |
|---|---|
| node-fs over `.steer/` | **Built** |
| memory (steer-ui/test fuel) | **Built** |

## Hosts applied

| Host | Notes |
|---|---|
| (none yet) | First application should pressure-test install + work + doctor + uninstall and feed corrections back into the playbooks |

## What a host actually compiles

This is the number that matters for "works with any framework". A host compiles
its own stylesheet, its component glob, and one mounter:

```ts
publishRegistration(globalThis, {
  modules: import.meta.glob("./components/**/*.tsx", { eager: true }),
  mounter: reactMounter,
  author: "andres",
})
```

Everything else is served, not built. That is why a Next host never sees Solid.
