import type { ReactNode } from "react"

export interface FieldProps {
  /** Label rendered above the control */
  label?: string
  /** Helper text under the control */
  hint?: string
  /** Mark the field as required */
  required?: boolean
  children?: ReactNode
}

/** Form field wrapper: label, any control, hint. Lives in a nested folder. */
export function Field({ label, hint, required, children }: FieldProps) {
  return (
    <div className="flex w-64 flex-col gap-1.5">
      {label && (
        <span className="text-sm font-medium text-zinc-700">
          {label}
          {required && <span className="ml-0.5 text-red-500">*</span>}
        </span>
      )}
      {children}
      {hint && <span className="text-xs text-zinc-400">{hint}</span>}
    </div>
  )
}
