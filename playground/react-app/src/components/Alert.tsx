import type { ReactNode } from "react"
import { X } from "lucide-react"
import type { Density, DismissableProps, Tone } from "./types"

export type AlertProps = DismissableProps & {
  /** Semantic color of the message. */
  tone?: Tone
  /** Vertical padding scale. */
  density?: Density
  title: string
  children?: ReactNode
}

const tones: Record<Tone, string> = {
  info: "border-sky-200 bg-sky-50 text-sky-900",
  success: "border-emerald-200 bg-emerald-50 text-emerald-900",
  danger: "border-red-200 bg-red-50 text-red-900",
}

const densities: Record<Density, string> = { 1: "py-2", 2: "py-3", 3: "py-4" }

/** Inline alert whose props come from imported types (checked extraction demo). */
export function Alert({ tone = "info", density = 2, title, dismissable, children }: AlertProps) {
  return (
    <div
      className={`flex items-start gap-3 rounded-xl border px-4 text-sm ${tones[tone]} ${densities[density]}`}
      role="status"
    >
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{title}</p>
        {children && <p className="mt-0.5 opacity-80">{children}</p>}
      </div>
      {dismissable && (
        <button
          type="button"
          className="cursor-pointer rounded-md p-0.5 opacity-50 transition-opacity hover:opacity-100"
          aria-label="Dismiss"
        >
          <X size={16} strokeWidth={2} />
        </button>
      )}
    </div>
  )
}
