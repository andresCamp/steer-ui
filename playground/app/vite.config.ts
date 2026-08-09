import { defineConfig } from "vite"
import solid from "vite-plugin-solid"
import tailwindcss from "@tailwindcss/vite"
import { steer } from "../../src/adapters/vite"

export default defineConfig({
  plugins: [solid(), tailwindcss(), steer({ typecheck: true })],
  server: {
    port: 5199,
  },
})
