import { describe, expect, it } from "vitest"
import { extractComponents } from "./extract"

const BUTTON = `
interface ButtonProps {
  /** Visual weight. */
  variant?: "primary" | "secondary" | "destructive" | "ghost"
  size?: "sm" | "md" | "lg"
  disabled?: boolean
  count?: number
  label: string
  onClick?: () => void
  children?: JSX.Element
}
/** A clickable button. */
export function Button(props: ButtonProps) { return null }
`

const CARD_EXPANDO = `
interface CardProps { title?: string; children?: JSX.Element }
export function Card(props: CardProps) { return null }
interface CardActionsProps { align?: "start" | "end" }
/** Action row. */
export function CardActions(props: CardActionsProps) { return null }
Card.Actions = CardActions
`

const TOOLBAR_ASSIGN = `
interface ToolbarRootProps { compact?: boolean }
/** Groups controls. */
function ToolbarRoot(props: ToolbarRootProps) { return null }
interface ToolbarSpacerProps { grow?: boolean }
function ToolbarSpacer(props: ToolbarSpacerProps) { return null }
export const Toolbar = Object.assign(ToolbarRoot, { Spacer: ToolbarSpacer })
export { ToolbarSpacer }
`

describe("extractComponents", () => {
  it("classifies every knob kind and keeps unsupported visible", () => {
    const [button] = extractComponents("src/components/Button.tsx", BUTTON)
    const byName = Object.fromEntries(button.props.map((p) => [p.name, p]))
    expect(byName.variant.kind).toBe("enum")
    expect(byName.variant.options).toEqual(["primary", "secondary", "destructive", "ghost"])
    expect(byName.variant.description).toBe("Visual weight.")
    expect(byName.size.kind).toBe("enum")
    expect(byName.disabled.kind).toBe("boolean")
    expect(byName.count.kind).toBe("number")
    expect(byName.label.kind).toBe("string")
    expect(byName.label.optional).toBe(false)
    expect(byName.onClick.kind).toBe("unsupported")
    expect(byName.children.kind).toBe("children")
    expect(button.description).toBe("A clickable button.")
  })

  it("keeps numeric enums coercible", () => {
    const [c] = extractComponents(
      "src/components/Grid.tsx",
      `interface GridProps { cols?: 1 | 2 | 3 }\nexport function Grid(p: GridProps) { return null }`
    )
    expect(c.props[0]).toMatchObject({ kind: "enum", numeric: true, options: ["1", "2", "3"] })
  })

  it("absorbs expando compound targets into the dotted entry with a render target", () => {
    const specs = extractComponents("src/components/Card.tsx", CARD_EXPANDO)
    const names = specs.map((s) => s.name).sort()
    expect(names).toEqual(["Card", "Card.Actions"])
    const actions = specs.find((s) => s.name === "Card.Actions")!
    expect(actions.slug).toBe("card-actions")
    expect(actions.target).toBe("CardActions")
    expect(actions.props[0].name).toBe("align")
    expect(actions.description).toBe("Action row.")
  })

  it("handles the Object.assign idiom: base takes root props, root absorbed", () => {
    const specs = extractComponents("src/components/Toolbar.tsx", TOOLBAR_ASSIGN)
    const names = specs.map((s) => s.name).sort()
    expect(names).toEqual(["Toolbar", "Toolbar.Spacer"])
    const toolbar = specs.find((s) => s.name === "Toolbar")!
    expect(toolbar.props[0].name).toBe("compact")
    expect(toolbar.description).toBe("Groups controls.")
    const spacer = specs.find((s) => s.name === "Toolbar.Spacer")!
    expect(spacer.target).toBe("ToolbarSpacer")
    expect(spacer.props[0].name).toBe("grow")
  })

  it("extracts every exported capitalized component in a multi-export file", () => {
    const specs = extractComponents(
      "src/components/Field.tsx",
      `export function Field() { return null }\nexport function FieldLabel() { return null }\nfunction helper() {}\nexport const NotAComponent = 3`
    )
    expect(specs.map((s) => s.name).sort()).toEqual(["Field", "FieldLabel", "NotAComponent"])
  })
})
