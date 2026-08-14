import { publishRegistration } from "../../../src/core/bridge"
import { reactMounter } from "../../../src/adapters/mount/react"

// Imported only by the virtual host entry. The host app must not import this.
//
// The React host compiles exactly this file and the React mounter. The bench it
// gets is the same prebuilt Solid chrome the Solid host gets, and no Solid ever
// enters this build.

publishRegistration(globalThis, {
  modules: import.meta.glob("./components/**/*.tsx", { eager: true }) as Record<
    string,
    Record<string, unknown>
  >,
  mounter: reactMounter,
  author: "andres",
})
