<script setup lang="ts">
import Button from "../components/Button.vue"
import Badge from "../components/Badge.vue"
import Card from "../components/Card.vue"
</script>

<template>
  <main class="mx-auto flex max-w-2xl flex-col gap-6 p-10">
    <header class="flex items-center gap-3">
      <h1 class="text-xl font-semibold">Acme Console</h1>
      <Badge tone="success" label="Live" />
    </header>
    <Card title="Danger zone" description="Deleting a project is permanent.">
      <Button variant="destructive" size="sm" label="Delete project" />
    </Card>
    <p class="text-sm text-zinc-500">
      This is the fake product. The interesting part is
      <a class="underline" href="/__steer">steer</a>.
    </p>
  </main>
</template>
