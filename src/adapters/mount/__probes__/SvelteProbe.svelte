<script lang="ts">
  // Counts instantiations, not renders: module init runs once per instance.
  import { instance } from "./svelte-instances.svelte"
  let { label = "" } = $props()
  const id = instance()
</script>

<div data-instance={id}>{label}</div>
