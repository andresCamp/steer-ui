export interface InputProps {
  /** Field label rendered above the control */
  label?: string
  /** Placeholder text inside the control */
  placeholder?: string
  /** Validation message; presence switches the field into its error state */
  error?: string
  /** Prevent editing */
  disabled?: boolean
}

/** Single-line text field with label and inline validation. */
export function Input({ label, placeholder, error, disabled }: InputProps) {
  return (
    <label className="flex w-64 flex-col gap-1.5">
      {label && <span className="text-sm font-medium text-zinc-700">{label}</span>}
      <input
        type="text"
        className={`h-10 rounded-lg border bg-white px-3 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none transition-colors focus:ring-2 disabled:bg-zinc-100 disabled:text-zinc-400 ${
          error
            ? "border-red-400 focus:border-red-500 focus:ring-red-100"
            : "border-zinc-300 focus:border-zinc-500 focus:ring-zinc-100"
        }`}
        placeholder={placeholder}
        disabled={disabled}
      />
      {error && <span className="text-xs text-red-600">{error}</span>}
    </label>
  )
}
