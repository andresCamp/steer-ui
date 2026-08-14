import { createComponent, createSignal } from "solid-js"
import { render } from "solid-js/web"
import type { MountHandle, Mounter } from "../../ports"

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

    const reactiveProps = new Proxy(
      {},
      {
        get: (_target, key: string | symbol) => current()[key as string],
        has: (_target, key: string | symbol) => (key as string) in current(),
        ownKeys: () => Reflect.ownKeys(current()),
        getOwnPropertyDescriptor: (_target, key: string | symbol) => ({
          value: current()[key as string],
          enumerable: true,
          configurable: true,
        }),
      }
    ) as Record<string, unknown>

    const dispose = render(
      () => createComponent(Component as never, reactiveProps as never),
      el
    )

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
