import { publishRegistration } from "../../../src/core/bridge"
import { vueMounter } from "../../../src/adapters/mount/vue"

// Imported only by the virtual host entry. The host app must not import this.
//
// A Vue host compiles this file and the Vue mounter. The bench it gets is the
// same prebuilt Solid chrome the Solid and React hosts get.

publishRegistration(globalThis, {
  modules: import.meta.glob("./components/**/*.vue", { eager: true }) as Record<
    string,
    Record<string, unknown>
  >,
  mounter: vueMounter,
  author: "andres",
  appLabel: "vue app",
})
