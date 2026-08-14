/**
 * @vitest-environment happy-dom
 */
import { createEffect, type JSX } from "solid-js"
import { act, createElement, useState as useReactState } from "react"
import { describe, expect, it } from "vitest"
import type { Mounter } from "../../ports"
import { reactMounter } from "./react"
import { solidMounter } from "./solid"

// One suite, every Mounter. This is the invariant that makes the single
// prebuilt chrome possible: if a framework can satisfy this contract, the
// bench can drive it without a canvas of its own. A new framework is
// therefore a ~40 line file plus an entry in CASES, never another surface.

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true

type Flush = (fn: () => void) => void

interface Case {
  mounter: Mounter
  Probe: unknown
  flush: Flush
}

// Probes report the instance number they were created with. If update()
// remounts instead of updating in place, data-instance changes and the
// "does not remount" invariant fails. Each framework counts instantiation
// its own way, which is the point: the contract is behavioural, not shared code.

let solidInstances = 0
function SolidProbe(props: Record<string, unknown>): JSX.Element {
  const instance = ++solidInstances
  const el = document.createElement("div")
  el.setAttribute("data-instance", String(instance))
  createEffect(() => {
    el.textContent = typeof props.label === "string" ? props.label : ""
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

const CASES: Record<string, Case> = {
  solid: { mounter: solidMounter, Probe: SolidProbe, flush: (fn) => fn() },
  react: { mounter: reactMounter, Probe: ReactProbe, flush: (fn) => act(fn) },
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

for (const [name, { mounter, Probe, flush }] of Object.entries(CASES)) {
  describe(`Mounter contract: ${name}`, () => {
    it("reports its framework id", () => {
      expect(mounter.id).toBe(name)
    })

    it("renders the component with its initial props", () => {
      const el = host()
      flush(() => void mounter.mount(el, Probe, { label: "first" }))
      expect(probe(el).textContent).toBe("first")
    })

    it("update() changes the rendered output", () => {
      const el = host()
      let handle!: ReturnType<Mounter["mount"]>
      flush(() => {
        handle = mounter.mount(el, Probe, { label: "before" })
      })
      flush(() => handle.update({ label: "after" }))
      expect(probe(el).textContent).toBe("after")
    })

    // The load-bearing invariant. Knob edits fire update() on every keystroke;
    // a remount would discard component state each time.
    it("update() does not remount the component", () => {
      const el = host()
      let handle!: ReturnType<Mounter["mount"]>
      flush(() => {
        handle = mounter.mount(el, Probe, { label: "a" })
      })
      const instance = probe(el).getAttribute("data-instance")
      flush(() => handle.update({ label: "b" }))
      flush(() => handle.update({ label: "c" }))
      expect(probe(el).getAttribute("data-instance")).toBe(instance)
      expect(probe(el).textContent).toBe("c")
    })

    it("update() replaces props rather than merging them", () => {
      const el = host()
      let handle!: ReturnType<Mounter["mount"]>
      flush(() => {
        handle = mounter.mount(el, Probe, { label: "present" })
      })
      flush(() => handle.update({}))
      expect(probe(el).textContent).toBe("")
    })

    it("destroy() empties the element", () => {
      const el = host()
      let handle!: ReturnType<Mounter["mount"]>
      flush(() => {
        handle = mounter.mount(el, Probe, { label: "x" })
      })
      flush(() => handle.destroy())
      expect(el.innerHTML).toBe("")
    })

    it("destroy() is idempotent and update() after destroy is inert", () => {
      const el = host()
      let handle!: ReturnType<Mounter["mount"]>
      flush(() => {
        handle = mounter.mount(el, Probe, { label: "x" })
      })
      flush(() => handle.destroy())
      expect(() =>
        flush(() => {
          handle.destroy()
          handle.update({ label: "zombie" })
        })
      ).not.toThrow()
      expect(el.innerHTML).toBe("")
    })

    it("mounts are independent of one another", () => {
      const a = host()
      const b = host()
      let ha!: ReturnType<Mounter["mount"]>
      let hb!: ReturnType<Mounter["mount"]>
      flush(() => {
        ha = mounter.mount(a, Probe, { label: "a" })
        hb = mounter.mount(b, Probe, { label: "b" })
      })
      flush(() => ha.update({ label: "a2" }))
      expect(probe(a).textContent).toBe("a2")
      expect(probe(b).textContent).toBe("b")
      flush(() => ha.destroy())
      expect(a.innerHTML).toBe("")
      expect(probe(b).textContent).toBe("b")
      flush(() => hb.destroy())
    })
  })
}
