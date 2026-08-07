import { defineConfig } from "vite"
import solid from "vite-plugin-solid"
import tailwindcss from "@tailwindcss/vite"
import { bench } from "./tooling/bench-plugin"

export default defineConfig({
  plugins: [solid(), tailwindcss(), bench()],
  server: {
    port: 5199,
  },
})
