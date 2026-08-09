import { registerComponents } from "../../../src/adapters/solid/data"

// The host's side of the render contract: the glob must live here because
// import.meta.glob resolves relative to the importing file. This is the
// entire per-host glue for the Solid surface.

registerComponents(import.meta.glob("./components/**/*.tsx", { eager: true }) as Record<
  string,
  Record<string, unknown>
>, { author: "andres" })
