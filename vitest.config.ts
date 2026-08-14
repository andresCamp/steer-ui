import { defineConfig } from "vitest/config"
import { svelte } from "@sveltejs/vite-plugin-svelte"
import solid from "vite-plugin-solid"

// solid-js/web resolves to its SERVER build under the `node` condition (see
// node_modules/solid-js/web/package.json exports), which makes `render` throw
// "Client-only API called on the server side". The mounter contract tests run
// real client rendering, so the browser build has to win.
export default defineConfig({
  // Compilers for the two frameworks whose source needs one. Solid because the
  // chrome's .tsx contains Solid JSX (the React mounter and its probes use
  // createElement, so they are unaffected); Svelte because $state is a rune.
  plugins: [solid(), svelte({ compilerOptions: { dev: true } })],
  resolve: {
    conditions: ["browser", "development"],
  },
  ssr: {
    resolve: {
      conditions: ["browser", "development"],
    },
  },
  test: {
    // vite-plugin-solid sets jsdom when it detects vitest. Pin node so the
    // suite stays fast and the per-file @vitest-environment docblocks decide
    // which files actually need a DOM.
    environment: "node",
  },
})
