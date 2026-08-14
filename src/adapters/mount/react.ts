import { createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import type { MountHandle, Mounter } from "../../ports"

// No JSX: createElement is what the React transform emits, so this file needs
// no framework compiler and can ship prebuilt.
//
// root.render on an existing root is a re-render, not a remount, so component
// state survives a props update, which is what MountHandle.update promises.

export const reactMounter: Mounter = {
  id: "react",

  mount(el: HTMLElement, Component: unknown, props: Record<string, unknown>): MountHandle {
    const root: Root = createRoot(el)
    root.render(createElement(Component as never, props as never))

    let live = true
    return {
      update(next: Record<string, unknown>) {
        if (!live) return
        root.render(createElement(Component as never, next as never))
      },
      destroy() {
        if (!live) return
        live = false
        root.unmount()
      },
    }
  },
}
