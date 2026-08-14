import { publishRegistration } from "../../../src/core/bridge"
import { solidMounter } from "../../../src/adapters/mount/solid"

// Imported only by the virtual bench entry. The host app must not import this.
//
// This is the ONLY host-compiled part of steer-ui: the component glob, which
// needs the host's own resolution and HMR, plus the Mounter for the host's
// framework. Everything else is the chrome, which never enters this build.

publishRegistration(globalThis, {
  modules: {
    ...(import.meta.glob("./components/**/*.tsx", { eager: true }) as Record<
      string,
      Record<string, unknown>
    >),
    ...(import.meta.glob("../../../src/adapters/chrome/parts/*.tsx", { eager: true }) as Record<
      string,
      Record<string, unknown>
    >),
  },
  mounter: solidMounter,
  author: "andres",
})
