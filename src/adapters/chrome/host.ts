import { createSignal } from "solid-js"
import type { Mounter } from "../../ports"
import { receiveRegistrations } from "../../core/bridge"
import { registerComponents } from "../../core/registry"

// The chrome's side of the bridge. Once the chrome ships prebuilt it is a
// separate module graph from the host's register entry, so the host's
// components and its Mounter arrive here at runtime rather than by import.
//
// The mounter is a signal because arrival order is not guaranteed: the chrome
// can boot before the host registers, in which case slots render empty until
// the registration lands and this re-runs them.

const [mounter, setMounter] = createSignal<Mounter | undefined>()

export { mounter }

/** Called once by the bench entry, before rendering. */
export function connectHost(): void {
  receiveRegistrations(globalThis as unknown as Record<string, unknown>, (registration) => {
    registerComponents(registration.modules, {
      author: registration.author,
      appLabel: registration.appLabel,
    })
    setMounter(() => registration.mounter)
  })
}
