import { registerComponents } from "../../../src/adapters/solid/data"

// Imported only by the virtual bench entry. The host app must not import this.

registerComponents(
  {
    ...(import.meta.glob("./components/**/*.tsx", { eager: true }) as Record<
      string,
      Record<string, unknown>
    >),
    ...(import.meta.glob("../../../src/adapters/solid/chrome/*.tsx", { eager: true }) as Record<
      string,
      Record<string, unknown>
    >),
  },
  { author: "andres" },
)
