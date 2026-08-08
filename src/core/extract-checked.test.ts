import { describe, expect, it } from "vitest"
import { extractComponents } from "./extract"
import { upgradePropsChecked } from "./extract-checked"
import { buildManifest } from "./manifest"
import type { SourceFile } from "./model"

const TYPES = {
  path: "src/components/types.ts",
  source: `
export type Tone = "info" | "success" | "danger"
export type Density = 1 | 2 | 3
export interface InteractiveProps {
  /** Prevent interaction. */
  disabled?: boolean
  tabIndex?: number
}
`,
}

const ALERT = {
  path: "src/components/Alert.tsx",
  source: `
import type { Tone, Density, InteractiveProps } from "./types"
export type AlertProps = InteractiveProps & {
  /** Semantic color. */
  tone?: Tone
  density?: Density
  title: string
  children?: JSX.Element
}
/** Inline alert. */
export function Alert(props: AlertProps) { return null }
`,
}

const IMPORTED_PROPS = {
  path: "src/components/Chip.tsx",
  source: `
import type { ChipProps } from "./chip-types"
export function Chip(props: ChipProps) { return null }
`,
}
const CHIP_TYPES = {
  path: "src/components/chip-types.ts",
  source: `export interface ChipProps { label?: string; active?: boolean }`,
}

const upgrade = (target: SourceFile, files: SourceFile[]) =>
  upgradePropsChecked(extractComponents(target.path, target.source), files)

describe("checked extraction (imported/intersection Props)", () => {
  it("resolves an intersection alias with imported unions into real knobs", () => {
    const [alert] = upgrade(ALERT, [ALERT, TYPES])
    const byName = Object.fromEntries(alert.props.map((p) => [p.name, p]))
    expect(byName.tone).toMatchObject({
      kind: "enum",
      options: ["info", "success", "danger"],
      description: "Semantic color.",
      optional: true,
    })
    expect(byName.density).toMatchObject({ kind: "enum", numeric: true, options: ["1", "2", "3"] })
    expect(byName.title).toMatchObject({ kind: "string", optional: false })
    expect(byName.children.kind).toBe("children")
    // intersection members from the imported interface arrive too
    expect(byName.disabled).toMatchObject({ kind: "boolean", description: "Prevent interaction." })
    expect(byName.tabIndex.kind).toBe("number")
  })

  it("resolves a wholly imported Props interface", () => {
    const [chip] = upgrade(IMPORTED_PROPS, [IMPORTED_PROPS, CHIP_TYPES])
    const byName = Object.fromEntries(chip.props.map((p) => [p.name, p]))
    expect(byName.label.kind).toBe("string")
    expect(byName.active.kind).toBe("boolean")
  })

  it("the syntactic pass alone marks these unsupported (the gap being bridged)", () => {
    const [alert] = extractComponents(ALERT.path, ALERT.source)
    // type alias over an intersection is not a type literal: no members found
    expect(alert.props).toEqual([])
    const [chip] = extractComponents(IMPORTED_PROPS.path, IMPORTED_PROPS.source)
    expect(chip.props).toEqual([])
  })

  it("keeps syntactic props when the checker cannot resolve (invariant 4)", () => {
    const orphan = {
      path: "src/components/Orphan.tsx",
      source: `import type { OrphanProps } from "./missing"\nexport function Orphan(p: OrphanProps) { return null }`,
    }
    const [spec] = upgrade(orphan, [orphan])
    expect(spec.props).toEqual([])
    const inline = {
      path: "src/components/Plain.tsx",
      source: `interface PlainProps { label?: string }\nexport function Plain(p: PlainProps) { return null }`,
    }
    const [plain] = upgrade(inline, [inline])
    expect(plain.props[0]).toMatchObject({ name: "label", kind: "string" })
  })

  it("upgrades compound targets through their target Props", () => {
    const compound = {
      path: "src/components/Card.tsx",
      source: `
import type { AlignProps } from "./card-types"
export function Card() { return null }
export function CardActions(p: AlignProps) { return null }
Card.Actions = CardActions
`,
    }
    // convention: the target's Props name; alias the imported type to match
    const cardTypes = {
      path: "src/components/card-types.ts",
      source: `export interface AlignProps { align?: "start" | "end" }`,
    }
    const withAlias = {
      ...compound,
      source: compound.source.replace(
        `import type { AlignProps } from "./card-types"`,
        `import type { AlignProps as CardActionsProps } from "./card-types"`
      ).replace("(p: AlignProps)", "(p: CardActionsProps)"),
    }
    const specs = upgrade(withAlias, [withAlias, cardTypes])
    const actions = specs.find((s) => s.name === "Card.Actions")!
    expect(actions.props[0]).toMatchObject({ kind: "enum", options: ["start", "end"] })
  })

  it("flows through buildManifest via config.typecheck", () => {
    const manifest = buildManifest({
      root: "/host",
      generatedAt: "2026-01-01T00:00:00.000Z",
      componentFiles: [ALERT],
      scanFiles: [ALERT, TYPES],
      config: { typecheck: true },
    })
    const alert = manifest.components.find((c) => c.name === "Alert")!
    expect(alert.props.find((p) => p.name === "tone")).toMatchObject({
      kind: "enum",
      options: ["info", "success", "danger"],
    })
    const syntactic = buildManifest({
      root: "/host",
      generatedAt: "2026-01-01T00:00:00.000Z",
      componentFiles: [ALERT],
      scanFiles: [ALERT, TYPES],
    })
    expect(syntactic.components.find((c) => c.name === "Alert")!.props).toEqual([])
  })
})
