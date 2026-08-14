/**
 * @vitest-environment happy-dom
 */
import { createEffect, createRoot, mergeProps, type JSX } from "solid-js"
import { act, createElement, useState as useReactState } from "react"
import { h, nextTick } from "vue"
import { describe, expect, it } from "vitest"
import type { Mounter } from "../../ports"
import { deferElement } from "../../core/registry"
import { reactMounter } from "./react"
import { solidMounter } from "./solid"
import { vueMounter } from "./vue"
import { svelteMounter } from "./svelte.svelte"
import SvelteProbe from "./__probes__/SvelteProbe.svelte"
import SvelteInner from "./__probes__/SvelteInner.svelte"
import SvelteWrapper from "./__probes__/SvelteWrapper.svelte"
import { flushSync } from "svelte"

// One suite, every Mounter. This is what makes the single prebuilt chrome
// possible: a framework that satisfies these invariants can be driven by the
// bench without a canvas of its own, so adding one is a small file plus an
// entry in CASES rather than another 1000 line surface.

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true

/** Frameworks schedule differently, so flushing is async for all of them. */
type Flush = (fn: () => void) => Promise<void>

interface Case {
  mounter: Mounter
  Probe: unknown
  Wrapper: unknown
  Inner: unknown
  flush: Flush
  /** Runs fn inside this framework's ownership scope. Solid creates instances
   *  under the current owner, so composing outside one would orphan them. */
  owned: <T>(fn: () => T) => T
}

// Probes report the instance they were created with. If update() remounts
// instead of updating in place, data-instance changes. Each framework counts
// instantiation its own way, which is the point: the contract is behavioural,
// not shared code.

let solidInstances = 0
function SolidProbe(props: Record<string, unknown>): JSX.Element {
  const instance = ++solidInstances
  const el = document.createElement("div")
  el.setAttribute("data-instance", String(instance))
  // Deliberately idiomatic: real Solid components run props through mergeProps
  // to apply defaults. mergeProps copies property descriptors, so a props
  // object exposing data descriptors instead of getters snapshots here and
  // stops updating. A probe that reads props directly never notices.
  const merged = mergeProps({ label: "" }, props)
  createEffect(() => {
    el.textContent = typeof merged.label === "string" ? merged.label : ""
  })
  return el as unknown as JSX.Element
}

function SolidInner(props: Record<string, unknown>): JSX.Element {
  const el = document.createElement("em")
  createEffect(() => {
    el.textContent = typeof props.label === "string" ? props.label : ""
  })
  return el as unknown as JSX.Element
}

function SolidWrapper(props: Record<string, unknown>): JSX.Element {
  const el = document.createElement("section")
  // A Solid component body runs once, so children must be read inside a
  // tracking scope. In real components that is JSX; here it is an effect.
  createEffect(() => {
    const child = props.children
    el.replaceChildren()
    if (child instanceof Node) el.appendChild(child)
  })
  return el as unknown as JSX.Element
}

let reactInstances = 0
function ReactProbe(props: Record<string, unknown>) {
  const [instance] = useReactState(() => ++reactInstances)
  return createElement(
    "div",
    { "data-instance": String(instance) },
    typeof props.label === "string" ? props.label : ""
  )
}

function ReactInner(props: Record<string, unknown>) {
  return createElement("em", null, typeof props.label === "string" ? props.label : "")
}

function ReactWrapper(props: Record<string, unknown>) {
  return createElement("section", null, props.children as never)
}

// Vue components are plain objects with a render function: no SFC, no compiler.
// setup() runs once per instance, so the counter tracks mounts, not renders.
let vueInstances = 0
const VueProbe = {
  props: { label: { type: String, default: "" } },
  setup(props: { label: string }) {
    const instance = ++vueInstances
    return () => h("div", { "data-instance": String(instance) }, props.label)
  },
}

const VueInner = {
  props: { label: { type: String, default: "" } },
  setup(props: { label: string }) {
    return () => h("em", null, props.label)
  },
}

const VueWrapper = {
  setup(_props: unknown, { slots }: { slots: Record<string, (() => unknown) | undefined> }) {
    return () => h("section", null, slots.default ? (slots.default() as never) : undefined)
  },
}

const CASES: Record<string, Case> = {
  solid: {
    mounter: solidMounter,
    Probe: SolidProbe,
    Wrapper: SolidWrapper,
    Inner: SolidInner,
    flush: async (fn) => void fn(),
    owned: (fn) => createRoot(fn),
  },
  react: {
    mounter: reactMounter,
    Probe: ReactProbe,
    Wrapper: ReactWrapper,
    Inner: ReactInner,
    flush: async (fn) => void act(fn),
    owned: (fn) => fn(),
  },
  svelte: {
    mounter: svelteMounter,
    Probe: SvelteProbe,
    Wrapper: SvelteWrapper,
    Inner: SvelteInner,
    flush: async (fn) => {
      fn()
      flushSync()
    },
    owned: (fn) => fn(),
  },
  vue: {
    mounter: vueMounter,
    Probe: VueProbe,
    Wrapper: VueWrapper,
    Inner: VueInner,
    flush: async (fn) => {
      fn()
      await nextTick()
    },
    owned: (fn) => fn(),
  },
}

function host(): HTMLElement {
  const el = document.createElement("div")
  document.body.appendChild(el)
  return el
}

function probe(el: HTMLElement): HTMLElement {
  const found = el.querySelector("[data-instance]")
  if (!found) throw new Error("probe not rendered")
  return found as HTMLElement
}

for (const [name, { mounter, Probe, Wrapper, Inner, flush, owned }] of Object.entries(CASES)) {
  describe(`Mounter contract: ${name}`, () => {
    it("reports its framework id", () => {
      expect(mounter.id).toBe(name)
    })

    it("renders the component with its initial props", async () => {
      const el = host()
      await flush(() => void mounter.mount(el, Probe, { label: "first" }))
      expect(probe(el).textContent).toBe("first")
    })

    it("update() changes the rendered output", async () => {
      const el = host()
      let handle!: ReturnType<Mounter["mount"]>
      await flush(() => {
        handle = mounter.mount(el, Probe, { label: "before" })
      })
      await flush(() => handle.update({ label: "after" }))
      expect(probe(el).textContent).toBe("after")
    })

    // The load-bearing invariant. Knob edits fire update() on every keystroke;
    // a remount would discard component state each time.
    it("update() does not remount the component", async () => {
      const el = host()
      let handle!: ReturnType<Mounter["mount"]>
      await flush(() => {
        handle = mounter.mount(el, Probe, { label: "a" })
      })
      const instance = probe(el).getAttribute("data-instance")
      await flush(() => handle.update({ label: "b" }))
      await flush(() => handle.update({ label: "c" }))
      expect(probe(el).getAttribute("data-instance")).toBe(instance)
      expect(probe(el).textContent).toBe("c")
    })

    it("update() replaces props rather than merging them", async () => {
      const el = host()
      let handle!: ReturnType<Mounter["mount"]>
      await flush(() => {
        handle = mounter.mount(el, Probe, { label: "present" })
      })
      await flush(() => handle.update({}))
      expect(probe(el).textContent).toBe("")
    })

    it("destroy() empties the element", async () => {
      const el = host()
      let handle!: ReturnType<Mounter["mount"]>
      await flush(() => {
        handle = mounter.mount(el, Probe, { label: "x" })
      })
      await flush(() => handle.destroy())
      expect(el.innerHTML).toBe("")
    })

    it("destroy() is idempotent and update() after destroy is inert", async () => {
      const el = host()
      let handle!: ReturnType<Mounter["mount"]>
      await flush(() => {
        handle = mounter.mount(el, Probe, { label: "x" })
      })
      await flush(() => handle.destroy())
      await expect(
        flush(() => {
          handle.destroy()
          handle.update({ label: "zombie" })
        })
      ).resolves.not.toThrow()
      expect(el.innerHTML).toBe("")
    })

    it("element() produces a value usable as a prop (composed children)", async () => {
      const el = host()
      await owned(() =>
        flush(() =>
          void mounter.mount(el, Wrapper, {
            children: mounter.element(Inner, { label: "nested" }),
          })
        )
      )
      expect(el.querySelector("section em")?.textContent).toBe("nested")
    })

    it("element() nests recursively", async () => {
      const el = host()
      await owned(() =>
        flush(() =>
          void mounter.mount(el, Wrapper, {
            children: mounter.element(Wrapper, {
              children: mounter.element(Inner, { label: "deep" }),
            }),
          })
        )
      )
      expect(el.querySelector("section section em")?.textContent).toBe("deep")
    })

    // The chrome bundles its own runtime, so it must not build instances: it
    // defers, and the mounter materializes inside its own owner. Without this
    // the chrome would work but leak every composed child's computations.
    it("materializes deferred elements passed as props", async () => {
      const el = host()
      await flush(() =>
        void mounter.mount(el, Wrapper, {
          children: deferElement(Inner, { label: "deferred" }),
        })
      )
      expect(el.querySelector("section em")?.textContent).toBe("deferred")
    })

    it("materializes deferred elements recursively", async () => {
      const el = host()
      await flush(() =>
        void mounter.mount(el, Wrapper, {
          children: deferElement(Wrapper, {
            children: deferElement(Inner, { label: "deep-deferred" }),
          }),
        })
      )
      expect(el.querySelector("section section em")?.textContent).toBe("deep-deferred")
    })

    it("materializes on update too", async () => {
      const el = host()
      let handle!: ReturnType<Mounter["mount"]>
      await flush(() => {
        handle = mounter.mount(el, Wrapper, {
          children: deferElement(Inner, { label: "first" }),
        })
      })
      await flush(() => handle.update({ children: deferElement(Inner, { label: "second" }) }))
      expect(el.querySelector("section em")?.textContent).toBe("second")
    })

    // A knob the human has not touched yet arrives as undefined, then gets a
    // value. Frameworks fix a component's prop keys at mount, so a prop that
    // starts undefined has to keep working when it is finally set.
    it("applies a prop that was undefined at mount", async () => {
      const el = host()
      let handle!: ReturnType<Mounter["mount"]>
      await flush(() => {
        handle = mounter.mount(el, Probe, { label: undefined })
      })
      expect(probe(el).textContent).toBe("")
      await flush(() => handle.update({ label: "set later" }))
      expect(probe(el).textContent).toBe("set later")
    })

    it("mounts are independent of one another", async () => {
      const a = host()
      const b = host()
      let ha!: ReturnType<Mounter["mount"]>
      let hb!: ReturnType<Mounter["mount"]>
      await flush(() => {
        ha = mounter.mount(a, Probe, { label: "a" })
        hb = mounter.mount(b, Probe, { label: "b" })
      })
      await flush(() => ha.update({ label: "a2" }))
      expect(probe(a).textContent).toBe("a2")
      expect(probe(b).textContent).toBe("b")
      await flush(() => ha.destroy())
      expect(a.innerHTML).toBe("")
      expect(probe(b).textContent).toBe("b")
      await flush(() => hb.destroy())
    })
  })
}
