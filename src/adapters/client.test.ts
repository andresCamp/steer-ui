/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it } from "vitest"
import { SLOT_ATTR, SURFACE_SELECTOR } from "../core/notes"
import { selectorWithin } from "./client"

// Note anchors are the fragile part of the product: a note pins to a selector
// and a coordinate, and a selector that silently shifts sends the agent to the
// wrong element. Mounting host components through a slot inserts a DOM level,
// so the slot has to be invisible to anchoring the same way display:contents
// makes it invisible to layout.

function build(html: string): HTMLElement {
  const bench = document.createElement("div")
  bench.innerHTML = html
  document.body.appendChild(bench)
  return bench
}

describe("selectorWithin", () => {
  it("returns the surface sentinel for the bench itself", () => {
    const bench = build("<button>x</button>")
    expect(selectorWithin(bench, bench)).toBe(SURFACE_SELECTOR)
  })

  it("builds a child path down to the target", () => {
    const bench = build("<section><p><button>x</button></p></section>")
    const target = bench.querySelector("button") as HTMLElement
    expect(selectorWithin(bench, target)).toBe("section > p > button")
  })

  it("disambiguates same-tag siblings by nth-of-type", () => {
    const bench = build("<p>a</p><p>b</p>")
    const second = bench.querySelectorAll("p")[1] as HTMLElement
    expect(selectorWithin(bench, second)).toBe("p:nth-of-type(2)")
  })

  // The regression this guards: without the skip, every anchor recorded through
  // the chrome would gain a leading "div > " that no host markup contains.
  it("skips the chrome's mount slot", () => {
    const bench = build(`<div ${SLOT_ATTR}><section><button>x</button></section></div>`)
    const target = bench.querySelector("button") as HTMLElement
    expect(selectorWithin(bench, target)).toBe("section > button")
  })

  it("produces the same anchor with and without a slot in the way", () => {
    const direct = build("<section><button>x</button></section>")
    const slotted = build(`<div ${SLOT_ATTR}><section><button>x</button></section></div>`)
    expect(selectorWithin(slotted, slotted.querySelector("button") as HTMLElement)).toBe(
      selectorWithin(direct, direct.querySelector("button") as HTMLElement)
    )
  })

  it("skips nested slots", () => {
    const bench = build(
      `<div ${SLOT_ATTR}><span><div ${SLOT_ATTR}><button>x</button></div></span></div>`
    )
    const target = bench.querySelector("button") as HTMLElement
    expect(selectorWithin(bench, target)).toBe("span > button")
  })

  it("returns the surface sentinel when the target is only wrapped in a slot", () => {
    const bench = build(`<div ${SLOT_ATTR}></div>`)
    const slot = bench.firstElementChild as HTMLElement
    expect(selectorWithin(bench, slot)).toBe(SURFACE_SELECTOR)
  })
})
