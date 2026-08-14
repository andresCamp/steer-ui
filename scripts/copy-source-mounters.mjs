import { cp, mkdir } from "node:fs/promises"
import path from "node:path"

// The Svelte mounter cannot be compiled here. $state is a compiler rune, so
// building it would strip the reactivity and the bench would render a Svelte
// component once and never update it again. It ships as source, and the host's
// Svelte plugin compiles it like any other .svelte.ts in its graph.
const SOURCE_ONLY = [["src/adapters/mount/svelte.svelte.ts", "dist/adapters/mount/svelte.svelte.ts"]]

for (const [from, to] of SOURCE_ONLY) {
  await mkdir(path.dirname(to), { recursive: true })
  await cp(from, to)
  console.log(`source  ${to}`)
}
