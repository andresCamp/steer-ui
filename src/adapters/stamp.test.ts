import { describe, expect, it } from "vitest"
import { slugFromComponentName, stampComponents } from "./stamp"

describe("stampComponents", () => {
  it("stamps name and static props on a host component", () => {
    const out = stampComponents(
      `export function Page() { return <Button variant="destructive" size="sm">X</Button> }`,
      "Demo.tsx",
    )
    expect(out).toContain('data-steer-component="Button"')
    expect(out).toContain("display")
    expect(out).toMatch(/variant/)
  })

  it("stamps compound tags and skips Solid control flow", () => {
    const out = stampComponents(
      `export function Page() { return <><Show when={true}><Card.Actions align="right" /></Show></> }`,
      "Demo.tsx",
    )
    expect(out).toContain('data-steer-component="Card.Actions"')
    expect(out).not.toContain('data-steer-component="Show"')
  })

  it("is a no-op when nothing to stamp", () => {
    expect(stampComponents(`export const x = 1`, "a.ts")).toBeUndefined()
  })
})

describe("slugFromComponentName", () => {
  it("mirrors extract slugs", () => {
    expect(slugFromComponentName("Button")).toBe("button")
    expect(slugFromComponentName("Card.Actions")).toBe("card-actions")
  })
})
