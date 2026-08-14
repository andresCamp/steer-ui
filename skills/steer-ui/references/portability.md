# Portability map (the adapter catalog)

What exists, what is a named gap. Promote host-built pieces back to the lab via the `onc9-primitives` skill; nothing enters this list without a lab test and a playground exercise.

## Extractors (source -> component specs)

| Language surface | Status |
|---|---|
| TypeScript TSX, syntactic (`interface <Name>Props`, type-literal aliases, string/numeric literal unions, JSDoc, expando + Object.assign compounds) | **Built + tested** (`core/extract.ts`) |
| Imported / aliased / intersection Props types | **Built + tested** (`core/extract-checked.ts`, opt-in `typecheck: true`; resolves through the TS checker over a virtual program; unresolvable falls back to syntactic) |
| Vue 3 SFC (`adapters/extract/vue.ts`) | **Built + tested**. Type-only `defineProps<T>()`, inline literal or local interface, `withDefaults` unwrapped, `<script setup>` preferred over a plain module script |
| Svelte 5 SFC (`adapters/extract/svelte.ts`) | **Built + tested**. Annotated `$props()` destructuring, inline literal or local `interface Props`, instance script preferred over `<script module>` |

Neither needs its framework's compiler. Both declare props as a TypeScript
annotation inside a `<script>` block, so the readers pull the script, parse it
with the TypeScript API already in the dependency tree, and run the SAME prop
classifier as TSX. A knob therefore behaves identically whatever the source
was, and the limit is the same one TSX has without `typecheck`: a Props type
imported from another module degrades to `unsupported` rather than being
guessed at.

Extraction is now a port (`Extractor`), chosen by file extension. Core knows
only the TSX reader; the driving adapters wire the SFC readers in, so core
never depends on a framework's file format.

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
| React (`adapters/mount/react.ts`, ~45 loc) | **Built + contract-tested + browser-verified** |
| Vue 3 (`adapters/mount/vue.ts`, ~50 loc) | **Built + contract-tested + browser-verified** against `playground/vue-app`: SFCs extracted, rendered in the chrome, composed children from a state URL, knob change patching in place |
| Svelte 5 (`adapters/mount/svelte.svelte.ts`, ~60 loc) | **Built + contract-tested**; not yet exercised against a real Svelte host |

All four pass the same 13 invariants. Vue and Svelte were added without a single
change to the port, the chrome, or core, which is the evidence that a framework
now costs a mounter rather than a canvas.

Two framework differences the mounters absorb, so the contract does not have to
grow a special case:

- **Children.** React and Solid take an element as a plain prop; Vue takes a
  slot; Svelte takes a snippet. Each mounter maps the manifest's `children` to
  its own idiom, so `{"$component": ...}` fixture refs and state URLs with
  composed children work identically everywhere. Svelte needs
  `createRawSnippet`, the public escape hatch for producing a snippet from JS.
- **Scheduling.** Solid is synchronous, React needs `act`, Vue needs
  `nextTick`, Svelte needs `flushSync`. That lives in the test harness, not in
  the port.

The one asymmetry worth knowing: the Svelte mounter is the only one that cannot
be plain TypeScript. `$state` is a compiler rune, so it lives in a `.svelte.ts`
file. That is fine, because the mounter is host-compiled by design and a Svelte
host already runs the Svelte plugin.

## Stores

| Store | Status |
|---|---|
| node-fs over `.steer/` | **Built** |
| memory (steer-ui/test fuel) | **Built** |

## Hosts applied

| Host | Notes |
|---|---|
| `playground/vue-app` (lab) | A real Vue 3 host on the prebuilt Solid chrome. Found three things unit tests could not: SFC default exports were not registered, the usage scan skipped SFC markup, and the chrome asset was served cacheable |
| (no external host yet) | First real application should pressure-test install + work + doctor + uninstall and feed corrections back into the playbooks |

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
