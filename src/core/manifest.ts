import { extractComponents } from "./extract"
import {
  DEFAULT_CONFIG,
  type BenchComponentSpec,
  type BenchConfig,
  type BenchManifest,
  type BenchUsage,
  type SourceFile,
} from "./model"

// Manifest assembly: pure over source text. The adapter that calls this owns
// I/O (reading files, watching, persisting); this module owns the derivation.

export interface ManifestInput {
  /** Host root, recorded verbatim (used by editors for file links). */
  root: string
  generatedAt: string
  /** Files under the component dir; paths relative to root. */
  componentFiles: SourceFile[]
  /** All files eligible for the usage scan (typically every .tsx under src/). */
  scanFiles: SourceFile[]
  config?: Partial<BenchConfig>
}

function scanUsages(
  scanFiles: SourceFile[],
  components: { name: string; file: string }[],
  config: BenchConfig
): Map<string, BenchUsage[]> {
  const usages = new Map<string, BenchUsage[]>()
  for (const c of components) usages.set(c.name, [])
  for (const { path: rel, source } of scanFiles) {
    // The bench's own rendering machinery does not count as usage.
    if (config.excludeDirs.some((dir) => rel.startsWith(dir))) continue
    const internal = rel.startsWith(config.componentDir)
    const lines = source.split("\n")
    for (const c of components) {
      if (internal && rel === c.file) continue // a component is not its own usage
      const tag = new RegExp(`<${c.name.replace(/\./g, "\\.")}[\\s/>]`)
      lines.forEach((line, i) => {
        if (tag.test(line)) {
          usages.get(c.name)!.push({
            file: rel,
            line: i + 1,
            snippet: line.trim().slice(0, 120),
            ...(internal ? { internal: true } : {}),
          })
        }
      })
    }
  }
  return usages
}

export function buildManifest(input: ManifestInput): BenchManifest {
  const config: BenchConfig = { ...DEFAULT_CONFIG, ...input.config }
  const specs: Omit<BenchComponentSpec, "usages">[] = []
  const warnings: string[] = []
  for (const file of input.componentFiles) {
    for (const spec of extractComponents(file.path, file.source)) {
      specs.push(spec)
    }
  }
  // Component names must be unique across the library; de-collide slugs so
  // every component keeps an address, and surface the conflict.
  const bySlug = new Map<string, number>()
  for (const spec of specs) {
    const original = spec.slug
    const seen = bySlug.get(original) ?? 0
    if (seen > 0) {
      warnings.push(`duplicate component name "${spec.name}" (${spec.file}); slug suffixed`)
      spec.slug = `${original}-${seen + 1}`
    }
    bySlug.set(original, seen + 1)
  }
  const usages = scanUsages(
    input.scanFiles,
    specs.map((s) => ({ name: s.name, file: s.file })),
    config
  )
  return {
    generatedAt: input.generatedAt,
    root: input.root,
    ...(warnings.length > 0 ? { warnings } : {}),
    components: specs
      .map((s) => ({ ...s, usages: usages.get(s.name) ?? [] }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  }
}
