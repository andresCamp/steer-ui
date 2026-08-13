// @ts-check
import { defineConfig } from "astro/config"
import solidJs from "@astrojs/solid-js"
import tailwindcss from "@tailwindcss/vite"

export default defineConfig({
  site: "https://steerui.com",
  integrations: [solidJs()],
  devToolbar: { enabled: false },
  vite: {
    plugins: [tailwindcss()],
    resolve: {
      // The bench surface is imported from the lab, above this project's root,
      // so Solid and the router would otherwise resolve to two copies and the
      // Route context would not reach <A> or useNavigate.
      dedupe: ["solid-js", "solid-js/web", "solid-js/store", "@solidjs/router"],
    },
    optimizeDeps: { include: ["@solidjs/router", "lucide-solid"] },
  },
})
