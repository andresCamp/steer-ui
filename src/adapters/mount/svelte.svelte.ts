import { createRawSnippet, mount, unmount } from "svelte"
import type { MountHandle, Mounter } from "../../ports"
import { materialize } from "../../core/registry"

// The only mounter that cannot be plain TypeScript. Svelte's reactivity is a
// compiler feature, so updating props without remounting needs a $state proxy,
// and $state is only available in .svelte.ts files. That is fine: the mounter
// is host-compiled by design, and a Svelte host already runs the Svelte plugin.
//
// Composed children are the interesting difference. React and Solid pass an
// element as a plain prop value; Svelte passes a snippet, which is normally
// something only the compiler produces. createRawSnippet is the public escape
// hatch: render a placeholder element, then mount the component into it during
// setup and unmount it on cleanup. That keeps `{"$component": ...}` fixture
// refs, and therefore state URLs with composed children, working for Svelte.

export function svelteElement(Component: unknown, props: Record<string, unknown>): unknown {
  return createRawSnippet(() => ({
    render: () => "<span></span>",
    setup: (element: Element) => {
      const instance = mount(Component as never, {
        target: element as HTMLElement,
        props: props as never,
      })
      return () => void unmount(instance)
    },
  }))
}

export const svelteMounter: Mounter = {
  id: "svelte",

  element: svelteElement,

  mount(el: HTMLElement, Component: unknown, props: Record<string, unknown>): MountHandle {
    // A $state proxy, so mutating it updates the mounted component in place.
    // Replacing keys rather than the object keeps the same proxy identity,
    // which is what Svelte's fine-grained updates track.
    const live: Record<string, unknown> = $state(
      materialize(props, svelteElement) as Record<string, unknown>
    )

    const instance = mount(Component as never, { target: el, props: live })

    let alive = true
    return {
      update(next: Record<string, unknown>) {
        if (!alive) return
        const values = materialize(next, svelteElement)
        for (const key of Object.keys(live)) {
          if (!(key in values)) delete live[key]
        }
        Object.assign(live, values)
      },
      destroy() {
        if (!alive) return
        alive = false
        unmount(instance)
        el.replaceChildren()
      },
    }
  },
}
