import { defineConfig } from "vitest/config"

// solid-js/web resolves to its SERVER build under the `node` condition (see
// node_modules/solid-js/web/package.json exports), which makes `render` throw
// "Client-only API called on the server side". The mounter contract tests run
// real client rendering, so the browser build has to win.
export default defineConfig({
  resolve: {
    conditions: ["browser", "development"],
  },
  ssr: {
    resolve: {
      conditions: ["browser", "development"],
    },
  },
})
