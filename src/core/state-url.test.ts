import { describe, expect, it } from "vitest"
import type { SteerComponentSpec } from "./model"
import {
  coerceProps,
  parseStateUrl,
  sameState,
  stateKey,
  stateUrl,
  stringifyFixtureValues,
} from "./state-url"

const spec: SteerComponentSpec = {
  name: "Button",
  slug: "button",
  file: "src/components/Button.tsx",
  props: [
    { name: "variant", kind: "enum", options: ["a", "b"], optional: true, raw: `"a" | "b"` },
    { name: "cols", kind: "enum", options: ["1", "2"], numeric: true, optional: true, raw: "1 | 2" },
    { name: "disabled", kind: "boolean", optional: true, raw: "boolean" },
    { name: "count", kind: "number", optional: true, raw: "number" },
    { name: "label", kind: "string", optional: true, raw: "string" },
    { name: "children", kind: "children", optional: true, raw: "JSX.Element" },
    { name: "onClick", kind: "unsupported", optional: true, raw: "() => void" },
  ],
  usages: [],
}

describe("state URL grammar (invariant 2)", () => {
  it("round-trips every knob configuration through the URL", () => {
    const values = { variant: "b", disabled: "true", count: "3", label: "hi there" }
    const url = stateUrl("button", values)
    expect(url).toMatch(/^\/__steer\/button\?/)
    const parsed = parseStateUrl(url)
    expect(parsed.slug).toBe("button")
    expect(parsed.values).toEqual(values)
  })

  it("round-trips composed children as JSON strings", () => {
    const values = stringifyFixtureValues({
      children: { $component: "Badge", props: { tone: "green" }, children: "Done" },
    })
    const parsed = parseStateUrl(stateUrl("card", values))
    expect(JSON.parse(parsed.values.children)).toEqual({
      $component: "Badge",
      props: { tone: "green" },
      children: "Done",
    })
  })

  it("drops empty values so URLs stay canonical", () => {
    expect(stateUrl("button", { variant: "", label: "x" })).toBe("/__steer/button?label=x")
  })

  it("coerces per the manifest: booleans, numbers, numeric enums", () => {
    const props = coerceProps(spec, {
      variant: "b",
      cols: "2",
      disabled: "true",
      count: "7",
      label: "go",
      onClick: "ignored",
    })
    expect(props).toEqual({ variant: "b", cols: 2, disabled: true, count: 7, label: "go" })
  })

  it("passes children through the injected resolver, or leaves the string", () => {
    expect(coerceProps(spec, { children: "plain" })).toEqual({ children: "plain" })
    const rendered = coerceProps(spec, { children: "plain" }, (v) => `<${v}>`)
    expect(rendered).toEqual({ children: "<plain>" })
  })

  it("matches states order-independently", () => {
    expect(stateKey({ a: "1", b: "2" })).toBe(stateKey({ b: "2", a: "1" }))
    expect(sameState({ a: "1" }, { a: "1", b: "" })).toBe(true)
    expect(sameState({ a: "1" }, { a: "2" })).toBe(false)
  })
})
