<script setup lang="ts">
/** Content container with an optional header. */
interface Props {
  /** Heading above the body. */
  title?: string
  /** Supporting line under the heading. */
  description?: string
  /** Body content; composed children serialize into the state URL. */
  children?: unknown
}
const props = withDefaults(defineProps<Props>(), {
  title: "Team settings",
  description: "Manage who has access to this workspace.",
})
</script>

<template>
  <div class="w-[380px] rounded-2xl border border-black/[0.08] bg-white p-6">
    <h3 class="text-base font-semibold text-zinc-900">{{ props.title }}</h3>
    <p class="mt-1 text-sm text-zinc-500">{{ props.description }}</p>
    <div class="mt-4"><slot /></div>
  </div>
</template>
