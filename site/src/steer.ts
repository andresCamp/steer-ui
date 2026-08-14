// The registry glue: the one piece that must live in the host, because
// import.meta.glob resolves relative to the calling file. The Mounter rides
// along, because instantiating a host component is the one thing the prebuilt
// chrome cannot do for itself.
import { publishRegistration } from "../../src/core/bridge"
import { solidMounter } from "../../src/adapters/mount/solid"

publishRegistration(globalThis, {
  modules: import.meta.glob("./components/**/*.tsx", { eager: true }) as Record<
    string,
    Record<string, unknown>
  >,
  mounter: solidMounter,
  author: "andrés",
  appLabel: "steerui.com",
})
