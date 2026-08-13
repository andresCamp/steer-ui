import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { steer } from "../../src/adapters/vite"

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    steer({
      typecheck: true,
      register: "src/steer.ts",
      styles: "src/app.css",
      surface: "react",
    }),
  ],
  server: {
    port: 5299,
  },
})
