import { defineConfig } from "tsup"

// The package has three kinds of code and they ship differently.
//
//  - Node code (engine, extractors, vite plugin, standalone server) is bundled
//    to ESM. TypeScript is external: it is a real runtime dependency of
//    extraction, not something to inline.
//  - Mounters are compiled by the HOST, so their framework stays external and
//    resolves to whichever copy the host already has. Two runtimes of the same
//    framework is the bug class that cost most of a day.
//  - The Svelte mounter is NOT here. $state is a compiler rune, so it ships as
//    source and the host's Svelte plugin compiles it. See package.json exports.
//
// clean is false on purpose: dist/chrome is the prebuilt chrome, produced by a
// separate vite build, and wiping it here would silently ship an empty bench.
export default defineConfig({
  entry: {
    index: "src/index.ts",
    "adapters/vite": "src/adapters/vite.ts",
    "adapters/node-server": "src/adapters/node-server.ts",
    "core/bridge": "src/core/bridge.ts",
    "core/registry": "src/core/registry.ts",
    "adapters/mount/solid": "src/adapters/mount/solid.ts",
    "adapters/mount/react": "src/adapters/mount/react.ts",
    "adapters/mount/vue": "src/adapters/mount/vue.ts",
    "cli/bin": "src/cli/bin.ts",
  },
  outDir: "dist",
  tsconfig: "tsconfig.build.json",
  format: ["esm"],
  target: "node20",
  platform: "neutral",
  dts: true,
  sourcemap: true,
  clean: false,
  splitting: true,
  treeshake: true,
  external: ["typescript", "vite", "solid-js", "react", "react-dom", "vue", "svelte"],
})
