import { createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import type { MountHandle, Mounter } from "../../ports"
import { materialize } from "../../core/registry"

// No JSX: createElement is what the React transform emits, so this file needs
// no framework compiler and can ship prebuilt.
//
// root.render on an existing root is a re-render, not a remount, so component
// state survives a props update, which is what MountHandle.update promises.

export const reactMounter: Mounter = {
  id: "react",

  element: reactElement,

  mount(el: HTMLElement, Component: unknown, props: Record<string, unknown>): MountHandle {
    const root: Root = createRoot(el)
    const draw = (values: Record<string, unknown>) =>
      root.render(createElement(Component as never, materialize(values, reactElement) as never))
    draw(props)

    let live = true
    return {
      update(next: Record<string, unknown>) {
        if (!live) return
        draw(next)
      },
      destroy() {
        if (!live) return
        live = false
        root.unmount()
      },
    }
  },
}

/** Composed children: a component instance passed as a prop value. React
 *  elements are inert descriptions, so this is owner-free. */
export function reactElement(Component: unknown, props: Record<string, unknown>): unknown {
  return createElement(Component as never, props as never)
}
