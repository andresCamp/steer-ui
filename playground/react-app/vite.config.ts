import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { steer } from "../../src/adapters/vite"

export default defineConfig({
  // Each playground has no node_modules of its own, so Vite's default cacheDir
  // (<root>/node_modules/.vite) resolves up to the REPO root and all three
  // hosts overwrite each other's optimized deps. Running two at once then
  // serves 504s for the loser's framework, which looks exactly like a broken
  // registry. One cache per host.
  cacheDir: ".vite",
  plugins: [
    react(),
    tailwindcss(),
    steer({
      typecheck: true,
      register: "src/steer.ts",
      styles: "src/app.css",
    }),
  ],
  server: {
    port: 5299,
  },
})
