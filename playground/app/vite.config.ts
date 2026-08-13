import { defineConfig } from "vite"
import solid from "vite-plugin-solid"
import tailwindcss from "@tailwindcss/vite"
import { steer } from "../../src/adapters/vite"

export default defineConfig({
  plugins: [
    solid(),
    tailwindcss(),
    steer({
      typecheck: true,
      extraComponentDirs: ["../../src/adapters/solid/chrome"],
      register: "src/steer.ts",
      styles: "src/app.css",
      surface: "solid",
    }),
  ],
  server: {
    port: 5199,
  },
})
