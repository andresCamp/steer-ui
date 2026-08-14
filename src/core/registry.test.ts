import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  clearRegistry,
  registerComponents,
  registry,
  resolveComponent,
  resolveFixtureValue,
  steerAppLabel,
  steerAuthor,
} from "./registry"

// The resolution chain exists because solid-refresh wraps exports in dev and
// hides expando properties, so Card.Actions resolves at build time and vanishes
// in dev. HANDOFF says do not simplify this chain; these tests are what makes
// that instruction enforceable rather than advisory.

const Button = () => "button"
const CardActions = () => "actions"
const Card = Object.assign(() => "card", { Actions: CardActions })

beforeEach(() => clearRegistry())

describe("registerComponents", () => {
  it("registers every capitalized function export, across modules", () => {
    registerComponents({
      "./Button.tsx": { Button },
      "./nested/Card.tsx": { Card, CardActions },
    })
    expect(Object.keys(registry).sort()).toContain("Button")
    expect(registry.CardActions).toBe(CardActions)
  })

  it("ignores lowercase and non-function exports", () => {
    registerComponents({ "./x.tsx": { helper: () => 1, DEFAULTS: { a: 1 }, Button } })
    expect(registry.helper).toBeUndefined()
    expect(registry.DEFAULTS).toBeUndefined()
    expect(registry.Button).toBe(Button)
  })

  it("registers compound members under their dotted name", () => {
    registerComponents({ "./Card.tsx": { Card } })
    expect(registry["Card.Actions"]).toBe(CardActions)
  })

  // A Vue/Svelte SFC compiles to a default export that is an object, not a
  // capitalized function. Without this the manifest lists the component and the
  // registry has nothing to render, which is a blank bench with no explanation.
  it("registers an SFC default export under its file name", () => {
    const VueCard = { render: () => null }
    registerComponents({ "./components/Card.vue": { default: VueCard } })
    expect(registry.Card).toBe(VueCard)
  })

  it("registers a Svelte SFC the same way", () => {
    const SvelteRow = { $$: true }
    registerComponents({ "./components/Row.svelte": { default: SvelteRow } })
    expect(registry.Row).toBe(SvelteRow)
  })

  it("ignores an SFC whose file name is not a component name", () => {
    registerComponents({ "./components/index.vue": { default: {} } })
    expect(Object.keys(registry)).toEqual([])
  })

  it("does not treat a .tsx default export as an SFC", () => {
    registerComponents({ "./components/Thing.tsx": { default: () => null, Thing: Button } })
    expect(registry.Thing).toBe(Button)
  })

  it("takes author and app label from options", () => {
    registerComponents({}, { author: "andres", appLabel: "playground" })
    expect(steerAuthor).toBe("andres")
    expect(steerAppLabel).toBe("playground")
  })

  it("defaults author and app label", () => {
    registerComponents({})
    expect(steerAuthor).toBe("human")
    expect(steerAppLabel).toBe("app")
  })
})

describe("resolveComponent", () => {
  it("resolves a direct name", () => {
    registerComponents({ "./Button.tsx": { Button } })
    expect(resolveComponent("Button")).toBe(Button)
  })

  it("falls back to the manifest target when the name is missing", () => {
    registerComponents({ "./Card.tsx": { CardActions } })
    expect(resolveComponent("Card.Actions", "CardActions")).toBe(CardActions)
  })

  it("resolves a dotted name through property access on the base", () => {
    registerComponents({ "./Card.tsx": { Card } })
    delete registry["Card.Actions"]
    expect(resolveComponent("Card.Actions")).toBe(CardActions)
  })

  // The solid-refresh case: the dev wrapper hides the expando, so neither the
  // dotted registration nor property access finds it. Naming convention is the
  // last line of defence, which is why compound targets must be named exports.
  it("falls back to the BaseSub naming convention when the expando is hidden", () => {
    const Wrapped = () => "wrapped card"
    registerComponents({ "./Card.tsx": { Card: Wrapped, CardActions } })
    expect(registry["Card.Actions"]).toBeUndefined()
    expect(resolveComponent("Card.Actions")).toBe(CardActions)
  })

  it("returns undefined for an unknown name", () => {
    expect(resolveComponent("Nope")).toBeUndefined()
    expect(resolveComponent("Nope.Missing")).toBeUndefined()
  })
})

describe("resolveFixtureValue", () => {
  const element = vi.fn((Component: unknown, props: Record<string, unknown>) => ({
    Component,
    props,
  }))

  beforeEach(() => element.mockClear())

  it("passes a plain string through untouched", () => {
    expect(resolveFixtureValue("hello", element)).toBe("hello")
    expect(element).not.toHaveBeenCalled()
  })

  it("returns a string that only looks like JSON", () => {
    expect(resolveFixtureValue("{not json", element)).toBe("{not json")
  })

  it("builds a component for a $component ref object", () => {
    registerComponents({ "./Button.tsx": { Button } })
    const out = resolveFixtureValue({ $component: "Button", props: { size: "sm" } }, element)
    expect(element).toHaveBeenCalledWith(Button, { size: "sm" })
    expect(out).toEqual({ Component: Button, props: { size: "sm" } })
  })

  it("builds a component for a $component ref serialized in a state URL", () => {
    registerComponents({ "./Button.tsx": { Button } })
    resolveFixtureValue(JSON.stringify({ $component: "Button" }), element)
    expect(element).toHaveBeenCalledWith(Button, {})
  })

  it("nests child refs recursively", () => {
    registerComponents({ "./Button.tsx": { Button }, "./Card.tsx": { Card } })
    resolveFixtureValue(
      { $component: "Card", children: { $component: "Button", props: { size: "sm" } } },
      element
    )
    expect(element).toHaveBeenNthCalledWith(1, Button, { size: "sm" })
    expect(element).toHaveBeenNthCalledWith(2, Card, {
      children: { Component: Button, props: { size: "sm" } },
    })
  })

  // Invariant 4: degrade visibly, never crash.
  it("renders a visible placeholder for an unknown component", () => {
    expect(resolveFixtureValue({ $component: "Ghost" }, element)).toBe(
      "[unknown component: Ghost]"
    )
    expect(element).not.toHaveBeenCalled()
  })
})
