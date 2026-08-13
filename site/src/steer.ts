// The registry glue: the one piece that must live in the host, because
// import.meta.glob resolves relative to the calling file.
import { registerComponents } from "../../src/adapters/solid/data"

registerComponents(
  import.meta.glob("./components/**/*.tsx", { eager: true }) as Record<
    string,
    Record<string, unknown>
  >,
  { author: "andrés", appLabel: "steerui.com" },
)
