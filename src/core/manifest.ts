import type { Extractor } from "../ports"
import { extractComponents, tsxExtractor } from "./extract"
import { upgradePropsChecked } from "./extract-checked"
import {
  DEFAULT_CONFIG,
  type SteerComponentSpec,
  type SteerConfig,
  type SteerManifest,
  type SteerUsage,
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
  /** Readers, one per language surface. Defaults to TSX alone. */
  extractors?: Extractor[]
  config?: Partial<SteerConfig>
}

function scanUsages(
  scanFiles: SourceFile[],
  components: { name: string; file: string }[],
  config: SteerConfig
): Map<string, SteerUsage[]> {
  const usages = new Map<string, SteerUsage[]>()
  for (const c of components) usages.set(c.name, [])
  for (const { path: rel, source } of scanFiles) {
    // Only JSX files can contain usages; .ts files ride along for the
    // checker but stay out of the scan.
    if (!rel.endsWith(".tsx")) continue
    // The steer's own rendering machinery does not count as usage.
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

export function buildManifest(input: ManifestInput): SteerManifest {
  // Explicit ?? per field: callers pass partial configs with undefined
  // properties, and an object spread would clobber the defaults with them.
  const config: SteerConfig = {
    componentDir: input.config?.componentDir ?? DEFAULT_CONFIG.componentDir,
    excludeDirs: input.config?.excludeDirs ?? DEFAULT_CONFIG.excludeDirs,
    typecheck: input.config?.typecheck ?? DEFAULT_CONFIG.typecheck,
  }
  let specs: Omit<SteerComponentSpec, "usages">[] = []
  const warnings: string[] = []
  // One reader per language surface, chosen by extension. A file no reader
  // claims is skipped rather than guessed at.
  const extractors = input.extractors ?? [tsxExtractor]
  for (const file of input.componentFiles) {
    const extractor = extractors.find((e) =>
      e.extensions.some((ext: string) => file.path.endsWith(ext))
    )
    if (!extractor) continue
    for (const spec of extractor.extract(file)) {
      specs.push(spec)
    }
  }
  if (config.typecheck) {
    // The checker builds a TS program, so it can only upgrade specs that came
    // from a TS source. SFC props stay syntactic.
    // The checker needs everything the Props types can reach, not just the
    // component files (imported types live anywhere in the scanned tree).
    const reachable = [...new Map(
      [...input.componentFiles, ...input.scanFiles].map((f) => [f.path, f])
    ).values()]
    specs = upgradePropsChecked(specs, reachable)
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
