import { mergeProps, Show, type JSX } from "solid-js"

export interface ButtonProps {
  /** Visual emphasis */
  variant?: "primary" | "secondary" | "ghost" | "destructive"
  /** Control height and padding */
  size?: "sm" | "md" | "lg"
  /** Prevent interaction */
  disabled?: boolean
  /** Replace label with a spinner while an action is in flight */
  loading?: boolean
  children?: JSX.Element
  onClick?: () => void
}

const variants: Record<string, string> = {
  primary: "bg-zinc-900 text-white hover:bg-zinc-700",
  secondary: "bg-white text-zinc-900 border border-zinc-300 hover:border-zinc-500",
  ghost: "bg-transparent text-zinc-600 hover:text-zinc-900",
  destructive: "bg-red-600 text-white hover:bg-red-500",
}

const sizes: Record<string, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-base",
}

/** The workhorse action trigger. */
export function Button(props: ButtonProps) {
  const p = mergeProps({ variant: "primary", size: "md" }, props)
  return (
    <button
      type="button"
      class={`inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:opacity-40 disabled:pointer-events-none ${variants[p.variant]} ${sizes[p.size]}`}
      disabled={p.disabled || p.loading}
      onClick={() => p.onClick?.()}
    >
      <Show when={p.loading}>
        <span class="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      </Show>
      {p.children}
    </button>
  )
}
