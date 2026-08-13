export const STEER_COMPONENT_ATTR = "data-steer-component"
export const STEER_PROPS_ATTR = "data-steer-props"

export function slugFromComponentName(name: string): string {
  return name.toLowerCase().replace(/\./g, "-")
}
