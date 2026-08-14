import { createApp, h, shallowRef, type App } from "vue"
import type { MountHandle, Mounter } from "../../ports"
import { materialize } from "../../core/registry"

// No SFC and no compiler: a render function plus h() is enough, so this file is
// plain TypeScript like the other mounters.
//
// One genuine framework difference has to be absorbed here. React and Solid pass
// children as a prop; Vue passes them as a slot. The manifest and the state URL
// grammar call it `children` either way, so the mounter maps it to the default
// slot. Absorbing exactly this kind of difference is what the port is for.

function vnode(Component: unknown, props: Record<string, unknown>) {
  const { children, ...rest } = props
  if (children === undefined) return h(Component as never, rest as never)
  return h(Component as never, rest as never, { default: () => children } as never)
}

export function vueElement(Component: unknown, props: Record<string, unknown>): unknown {
  return vnode(Component, props)
}

export const vueMounter: Mounter = {
  id: "vue",

  element: vueElement,

  mount(el: HTMLElement, Component: unknown, props: Record<string, unknown>): MountHandle {
    const current = shallowRef(props)

    // A shallowRef of the whole props object: replacing it re-renders, and
    // because the vnode type is unchanged Vue patches rather than remounts, so
    // component state survives a knob edit.
    const app: App = createApp({
      render: () => vnode(Component, materialize(current.value, vueElement)),
    })
    app.mount(el)

    let live = true
    return {
      update(next: Record<string, unknown>) {
        if (!live) return
        current.value = next
      },
      destroy() {
        if (!live) return
        live = false
        app.unmount()
      },
    }
  },
}
