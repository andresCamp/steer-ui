export const BANDS = [
  { id: "xl", min: 1100 },
  { id: "lg", min: 1000 },
  { id: "md", min: 900 },
  { id: "sm", min: 560 },
  { id: "xs", min: 0 },
] as const

export type Band = (typeof BANDS)[number]["id"]

export function bandOf(width: number): (typeof BANDS)[number] {
  return BANDS.find((b) => width >= b.min) ?? BANDS[BANDS.length - 1]
}
