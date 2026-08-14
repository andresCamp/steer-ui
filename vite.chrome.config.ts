import { defineConfig } from "vite"
import solid from "vite-plugin-solid"
import tailwindcss from "@tailwindcss/vite"

// Builds the chrome into a self-contained asset. This is the whole point of the
// architecture: the host serves these files, it never compiles them, so Solid
// stays out of a React or Vue host's bundle.
export default defineConfig({
  plugins: [solid(), tailwindcss()],
  build: {
    outDir: "dist/chrome",
    emptyOutDir: true,
    cssCodeSplit: true,
    rollupOptions: {
      input: {
        bench: "src/adapters/chrome/bench.tsx",
        overlay: "src/adapters/chrome/overlay.ts",
      },
      output: {
        format: "es",
        entryFileNames: "[name].js",
        chunkFileNames: "[name]-[hash].js",
        assetFileNames: "[name][extname]",
      },
    },
  },
})
