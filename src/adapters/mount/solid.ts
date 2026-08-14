import { createComponent, createMemo, createSignal } from "solid-js"
import { render } from "solid-js/web"
import type { MountHandle, Mounter } from "../../ports"
import { materialize } from "../../core/registry"

// No JSX: createComponent is what the Solid compiler emits for <Comp {...p} />,
// so this file needs no framework compiler and can ship prebuilt.
//
// Props go through a Proxy over a signal rather than a plain object because
// Solid components read props lazily and reactively. Setting the signal
// therefore updates the live instance in place instead of remounting it,
// which is what MountHandle.update promises.

export const solidMounter: Mounter = {
  id: "solid",

  element: solidElement,

  mount(el: HTMLElement, Component: unknown, props: Record<string, unknown>): MountHandle {
    const [current, setCurrent] = createSignal<Record<string, unknown>>(props)

    const dispose = render(() => {
      // Inside render, so this owner belongs to THIS runtime and composed
      // children created here dispose with the mounted tree.
      const values = createMemo(() => materialize(current(), solidElement))

      const reactiveProps = new Proxy(
        {},
        {
          get: (_target, key: string | symbol) => values()[key as string],
          has: (_target, key: string | symbol) => (key as string) in values(),
          ownKeys: () => Reflect.ownKeys(values()),
          // An ACCESSOR descriptor, not a data one. Idiomatic Solid components
          // run props through mergeProps for defaults, and anything that copies
          // descriptors would snapshot a `value` and silently lose reactivity:
          // the canvas then shows a stale component while the state URL claims
          // otherwise. A getter survives the copy.
          getOwnPropertyDescriptor: (_target, key: string | symbol) => ({
            get: () => values()[key as string],
            enumerable: true,
            configurable: true,
          }),
        }
      ) as Record<string, unknown>

      return createComponent(Component as never, reactiveProps as never)
    }, el)

    let live = true
    return {
      update(next: Record<string, unknown>) {
        if (!live) return
        setCurrent(() => next)
      },
      destroy() {
        if (!live) return
        live = false
        dispose()
      },
    }
  },
}

/** Composed children: a component instance passed as a prop value. Called
 *  during render, so it inherits the canvas's owner. */
export function solidElement(Component: unknown, props: Record<string, unknown>): unknown {
  return createComponent(Component as never, props as never)
}
