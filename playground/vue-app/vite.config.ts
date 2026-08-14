import { defineConfig } from "vite"
import vue from "@vitejs/plugin-vue"
import tailwindcss from "@tailwindcss/vite"
import { steer } from "../../src/adapters/vite"

export default defineConfig({
  plugins: [
    vue(),
    tailwindcss(),
    steer({
      register: "src/steer.ts",
      styles: "src/app.css",
    }),
  ],
  server: {
    port: 5399,
  },
})
