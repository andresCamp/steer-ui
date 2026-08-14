<script setup lang="ts">
/** Small status label for rows, cards, and headers. */
interface Props {
  /** Colour role. */
  tone?: "default" | "success" | "warning" | "danger"
  /** Text inside the badge. */
  label?: string
}
const props = withDefaults(defineProps<Props>(), { tone: "default", label: "Badge" })

const tones: Record<string, string> = {
  default: "bg-zinc-100 text-zinc-700",
  success: "bg-emerald-50 text-emerald-700",
  warning: "bg-amber-50 text-amber-700",
  danger: "bg-red-50 text-red-700",
}
</script>

<template>
  <span
    :class="['inline-flex items-center rounded-full px-2.5 py-0.5 text-sm font-medium', tones[props.tone]]"
  >
    {{ props.label }}
  </span>
</template>
