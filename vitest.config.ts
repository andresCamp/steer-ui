import { defineConfig } from "vitest/config"
import { svelte } from "@sveltejs/vite-plugin-svelte"

// solid-js/web resolves to its SERVER build under the `node` condition (see
// node_modules/solid-js/web/package.json exports), which makes `render` throw
// "Client-only API called on the server side". The mounter contract tests run
// real client rendering, so the browser build has to win.
export default defineConfig({
  // Only .svelte / .svelte.ts files go through this; everything else is
  // untouched. The Svelte mounter needs it because $state is a compiler rune.
  plugins: [svelte({ compilerOptions: { dev: true } })],
  resolve: {
    conditions: ["browser", "development"],
  },
  ssr: {
    resolve: {
      conditions: ["browser", "development"],
    },
  },
})
