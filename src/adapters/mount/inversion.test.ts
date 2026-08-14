/**
 * @vitest-environment happy-dom
 */
import { createEffect, type JSX } from "solid-js"
import { createElement } from "react"
import { act } from "react"
import { describe, expect, it } from "vitest"
import type { Mounter, MountHandle, SteerRegistration } from "../../ports"
import { publishRegistration, receiveRegistrations } from "../../core/bridge"
import { reactMounter } from "./react"
import { solidMounter } from "./solid"

// The architecture bet, end to end: a chrome that imports NO framework can
// render a host's components, because the only framework-aware code is the
// Mounter the host hands it across the bridge.
//
// What this pins: the bridge and the Mounter compose, in both load orders,
// for two unrelated reactivity models. What it does NOT pin: the bundling
// step that makes the chrome a separately-built artifact. That is the build
// config, proven by `pnpm dev`, not by a unit test.

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true

// ---------------------------------------------------------------------------
// The "chrome". Plain DOM. Note the absence of any framework import here: this
// function is what ships prebuilt, and it never learns what the host is built
// with. Everything framework-specific arrives in `registration.mounter`.
// ---------------------------------------------------------------------------

interface FakeChrome {
  slot: HTMLElement
  setProps(props: Record<string, unknown>): void
  teardown(): void
}

function bootChrome(target: Record<string, unknown>, root: HTMLElement): FakeChrome {
  const slot = document.createElement("div")
  slot.setAttribute("data-steer-slot", "")
  root.appendChild(slot)

  let handle: MountHandle | undefined

  const onRegister = (registration: SteerRegistration) => {
    handle?.destroy()
    const [, exports] = Object.entries(registration.modules)[0] ?? []
    const Component = exports?.["Probe"]
    if (!Component) throw new Error("chrome could not resolve a component")
    handle = registration.mounter.mount(slot, Component, { label: "initial" })
  }

  const received = receiveRegistrations(target, onRegister)

  return {
    slot,
    setProps: (props) => handle?.update(props),
    teardown: () => {
      handle?.destroy()
      received.stop()
    },
  }
}

// ---------------------------------------------------------------------------
// Host sides. Each is a framework's component plus its mounter, exactly what a
// host's register entry would publish.
// ---------------------------------------------------------------------------

let solidInstances = 0
function SolidProbe(props: Record<string, unknown>): JSX.Element {
  const instance = ++solidInstances
  const el = document.createElement("p")
  el.setAttribute("data-instance", `solid-${instance}`)
  createEffect(() => {
    el.textContent = typeof props.label === "string" ? props.label : ""
  })
  return el as unknown as JSX.Element
}

function ReactProbe(props: Record<string, unknown>) {
  return createElement(
    "p",
    { "data-instance": "react-1" },
    typeof props.label === "string" ? props.label : ""
  )
}

interface HostCase {
  mounter: Mounter
  registration: SteerRegistration
  flush: (fn: () => void) => void
}

const HOSTS: Record<string, HostCase> = {
  solid: {
    mounter: solidMounter,
    registration: {
      modules: { "./Probe.tsx": { Probe: SolidProbe } },
      mounter: solidMounter,
      author: "andres",
    },
    flush: (fn) => fn(),
  },
  react: {
    mounter: reactMounter,
    registration: {
      modules: { "./Probe.tsx": { Probe: ReactProbe } },
      mounter: reactMounter,
      author: "andres",
    },
    flush: (fn) => act(fn),
  },
}

function root(): HTMLElement {
  const el = document.createElement("div")
  document.body.appendChild(el)
  return el
}

for (const [name, host] of Object.entries(HOSTS)) {
  describe(`chrome inversion: ${name} host`, () => {
    it("renders a host component when the chrome booted first", () => {
      const target = {}
      const el = root()
      let chrome!: FakeChrome
      host.flush(() => {
        chrome = bootChrome(target, el)
      })
      host.flush(() => void publishRegistration(target, host.registration))

      expect(chrome.slot.textContent).toBe("initial")
      host.flush(() => chrome.teardown())
    })

    it("renders a host component when the host registered first", () => {
      const target = {}
      const el = root()
      host.flush(() => void publishRegistration(target, host.registration))
      let chrome!: FakeChrome
      host.flush(() => {
        chrome = bootChrome(target, el)
      })

      expect(chrome.slot.textContent).toBe("initial")
      host.flush(() => chrome.teardown())
    })

    it("drives props through the mounter without remounting", () => {
      const target = {}
      const el = root()
      let chrome!: FakeChrome
      host.flush(() => {
        chrome = bootChrome(target, el)
      })
      host.flush(() => void publishRegistration(target, host.registration))

      const before = chrome.slot.querySelector("[data-instance]")?.getAttribute("data-instance")
      host.flush(() => chrome.setProps({ label: "steered" }))

      expect(chrome.slot.textContent).toBe("steered")
      expect(chrome.slot.querySelector("[data-instance]")?.getAttribute("data-instance")).toBe(before)
      host.flush(() => chrome.teardown())
    })

    it("teardown leaves the slot empty", () => {
      const target = {}
      const el = root()
      let chrome!: FakeChrome
      host.flush(() => {
        chrome = bootChrome(target, el)
      })
      host.flush(() => void publishRegistration(target, host.registration))
      host.flush(() => chrome.teardown())

      expect(chrome.slot.innerHTML).toBe("")
    })
  })
}
