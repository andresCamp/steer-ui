/**
 * @vitest-environment happy-dom
 */
import { createEffect, createSignal } from "solid-js"
import { render } from "solid-js/web"
import { afterEach, describe, expect, it } from "vitest"
import { clearRegistry, registerComponents } from "../../core/registry"
import { publishRegistration } from "../../core/bridge"
import { solidMounter } from "../mount/solid"
import { HostSlot } from "./HostSlot"
import { connectHost } from "./host"

// HostSlot is where the manifest meets the host. The manifest is derived from
// source, so it can name a component this host cannot instantiate: a .vue file
// in a Solid host, or a registry glob that missed a folder. Rendering nothing
// there reads as "this component is empty", which sends the human and the agent
// hunting a bug in the component instead of a gap in the wiring.

function Chip(props: Record<string, unknown>) {
  const el = document.createElement("b")
  // A Solid component body runs once, so the read has to sit in a tracking
  // scope. In a real component that is JSX; here it is an effect.
  createEffect(() => {
    el.textContent = typeof props.label === "string" ? props.label : ""
  })
  return el as unknown as never
}

const disposers: (() => void)[] = []

function mountSlot(name: string, values: Record<string, unknown> = {}): HTMLElement {
  const host = document.createElement("div")
  document.body.appendChild(host)
  disposers.push(render(() => <HostSlot name={name} values={values} />, host))
  return host
}

afterEach(() => {
  while (disposers.length) disposers.pop()?.()
  clearRegistry()
})

describe("HostSlot", () => {
  // Every knob edit flows through here. If the slot does not re-run when its
  // values change, the canvas shows a stale component while the state URL says
  // otherwise: the bench silently lies about what you are looking at.
  it("re-renders when its values change", () => {
    const [values, setValues] = createSignal<Record<string, unknown>>({ label: "one" })
    connectHost()
    publishRegistration(globalThis as never, {
      modules: { "./Chip.tsx": { Chip } },
      mounter: solidMounter,
    })

    const el = document.createElement("div")
    document.body.appendChild(el)
    disposers.push(render(() => <HostSlot name="Chip" values={values()} />, el))
    expect(el.querySelector("b")?.textContent).toBe("one")

    setValues({ label: "two" })
    expect(el.querySelector("b")?.textContent).toBe("two")
  })

  it("mounts a registered component through the host's mounter", () => {
    const target = {}
    connectHost.call(null)
    registerComponents({ "./Chip.tsx": { Chip } })
    publishRegistration(globalThis as never, {
      modules: { "./Chip.tsx": { Chip } },
      mounter: solidMounter,
    })
    const host = mountSlot("Chip", { label: "hello" })
    expect(host.querySelector("b")?.textContent).toBe("hello")
    void target
  })

  it("says so when the manifest names a component this host never registered", () => {
    publishRegistration(globalThis as never, {
      modules: {},
      mounter: solidMounter,
    })
    const host = mountSlot("VuePreview")
    const note = host.querySelector("[data-steer-unresolved]")
    expect(note?.getAttribute("data-steer-unresolved")).toBe("VuePreview")
    expect(note?.textContent).toContain("VuePreview")
    expect(note?.textContent).toContain("not registered")
  })

  it("marks the slot so the notice never pollutes a note anchor", () => {
    publishRegistration(globalThis as never, { modules: {}, mounter: solidMounter })
    const host = mountSlot("Missing")
    expect(host.querySelector("[data-steer-slot]")).not.toBeNull()
  })
})
