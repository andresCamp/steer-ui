import type { ComponentType } from "react"
import { reactElement } from "../mount/react"
import type { SteerComponentSpec, FixtureValue } from "../../core/model"
import {
  coerceProps as coercePropsCore,
  resolveComponent as resolveComponentCore,
  resolveFixtureValue as resolveFixtureValueCore,
} from "../../core/registry"

// React render surface glue: the component registry, fixture-ref rendering,
// and re-exports of the shared client. The pure contract (types, URL
// grammar, coercion) lives in core; this file only binds it to React.

export type {
  SteerComponentSpec,
  SteerFixture,
  SteerManifest,
  SteerNote,
  SteerProp,
  SteerReply,
  SteerUsage,
  ComponentRef,
  DoctorReport,
  FixtureValue,
} from "../../core/model"
export {
  sameState,
  stateKey,
  stateUrl,
  parseStateUrl,
  stringifyFixtureValues,
} from "../../core/state-url"
export {
  fetchDoctor,
  fetchFixture,
  fetchManifest,
  fetchNotes,
  moveNote,
  postNote,
  replyNote,
  resolveNote,
  selectorWithin,
} from "../client"

// --- component registry ----------------------------------------------------
// Lives in core/registry.ts, framework free, so the prebuilt chrome can use it
// too. Re-exported here as live bindings so consumers keep importing from data.

export { registry, registerComponents, clearRegistry } from "../../core/registry"
export { steerAuthor, steerAppLabel } from "../../core/registry"

/** Resolve a manifest name to a React component. Chain lives in core. */
export function resolveComponent(
  name: string,
  target?: string
): ComponentType<Record<string, unknown>> | undefined {
  return resolveComponentCore(name, target) as
    | ComponentType<Record<string, unknown>>
    | undefined
}

// --- fixture-ref rendering -------------------------------------------------
// The one framework-aware step is building the instance, which is exactly
// Mounter.element. Bound here so callers keep the same signatures.

const element = reactElement

/** A children value: a plain string, or a JSON {"$component": ...} ref. */
export function resolveFixtureValue(value: FixtureValue): unknown {
  return resolveFixtureValueCore(value, element)
}

/** Core coercion bound to this registry's children renderer. */
export function coerceProps(
  spec: SteerComponentSpec,
  values: Record<string, string | undefined>
): Record<string, unknown> {
  return coercePropsCore(spec, values, element)
}
