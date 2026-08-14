<script setup lang="ts">
/** The workhorse action trigger. */
interface Props {
  /** Visual weight. */
  variant?: "primary" | "secondary" | "destructive" | "ghost"
  /** Control height. */
  size?: "sm" | "md" | "lg"
  /** Label text. */
  label?: string
  /** Blocks interaction and dims the control. */
  disabled?: boolean
}
const props = withDefaults(defineProps<Props>(), {
  variant: "primary",
  size: "md",
  label: "Button",
  disabled: false,
})

const variants: Record<string, string> = {
  primary: "bg-zinc-900 text-white hover:bg-zinc-800",
  secondary: "bg-white text-zinc-900 border border-black/10 hover:border-black/20",
  destructive: "bg-red-600 text-white hover:bg-red-500",
  ghost: "text-zinc-700 hover:bg-black/5",
}
const sizes: Record<string, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-[15px]",
  lg: "h-12 px-6 text-base",
}
</script>

<template>
  <button
    type="button"
    :disabled="props.disabled"
    :class="[
      'inline-flex items-center justify-center rounded-lg font-medium transition-colors',
      variants[props.variant],
      sizes[props.size],
      props.disabled && 'pointer-events-none opacity-50',
    ]"
  >
    {{ props.label }}
  </button>
</template>
