import { defineConfig } from "vite"

// Deliberately framework-free. The anchoring contract is framework-neutral
// (model.ts invariant 5), so proving it in plain DOM keeps Solid and React
// render behaviour out of the measurement.
export default defineConfig({
  server: { port: 5399 },
})
