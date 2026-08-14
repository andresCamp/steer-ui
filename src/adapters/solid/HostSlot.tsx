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
      // Invariant 4: degrade VISIBLY. The manifest is derived from source, so
      // it can list a component this host cannot instantiate: a .vue file in a
      // Solid host, or a registry glob that missed it. Rendering nothing would
      // read as "this component is empty" rather than "nothing mounted it".
      slot.replaceChildren()
      if (!mount) return
      const note = document.createElement("p")
      note.setAttribute("data-steer-unresolved", props.name)
      note.style.cssText =
        "margin:0;padding:12px 16px;border:1px dashed rgba(0,0,0,.2);border-radius:10px;" +
        "font:14px ui-monospace,SFMono-Regular,Menlo,monospace;color:#71717a"
      note.textContent = `${props.name} is in the manifest but not registered here`
      slot.appendChild(note)
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
