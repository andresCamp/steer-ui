import { createEffect, onCleanup } from "solid-js"
import type { MountHandle } from "../../ports"
import { resolveComponent } from "../../core/registry"
import { mounter } from "./host"

export interface HostSlotProps {
  /** Manifest name, dotted for compounds. */
  name: string
  /** Manifest target, the fallback for dev-mode HMR wrappers. */
  target?: string
  /** Coerced props for this state. */
  values: Record<string, unknown>
}

/**
 * Renders a HOST component inside the chrome.
 *
 * The chrome cannot instantiate it directly: the host may be React or Vue while
 * this canvas is Solid, so instantiation goes through the Mounter the host
 * published across the bridge. Replacing <Dynamic> with this is what lets one
 * canvas serve every framework.
 *
 * display:contents keeps the mount point out of layout, so a host component
 * lays out exactly as it did when the canvas rendered it directly.
 */
export function HostSlot(props: HostSlotProps) {
  let slot!: HTMLDivElement
  let handle: MountHandle | undefined
  let mounted: unknown

  createEffect(() => {
    const mount = mounter()
    const component = resolveComponent(props.name, props.target)
    const values = props.values

    if (!mount || !component) {
      handle?.destroy()
      handle = undefined
      mounted = undefined
      return
    }

    // Same component, new props: update in place. Remounting here would
    // discard host component state on every knob keystroke.
    if (handle && mounted === component) {
      handle.update(values)
      return
    }

    handle?.destroy()
    mounted = component
    handle = mount.mount(slot, component, values)
  })

  onCleanup(() => handle?.destroy())

  // data-steer-slot marks this as chrome scaffolding: display:contents keeps
  // it out of layout, and selectorWithin skips it so note anchors describe
  // the host component's own structure, not ours.
  return <div ref={slot} data-steer-slot style={{ display: "contents" }} />
}
