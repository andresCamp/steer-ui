import { promises as fs } from "node:fs"
import { existsSync, mkdirSync } from "node:fs"
import path from "node:path"
import type { FixtureStore, ManifestStore, NoteStore, SourceStore } from "../ports"
import type { SteerManifest, SteerNote, SourceFile } from "../core/model"
import { migrateNotes } from "../core/notes"

// Filesystem adapters: the real stores behind a host's .steer/ directory
// and source tree. Everything the pure core needs, nothing more.

const STEER_DIR = ".steer"

async function listFiles(dir: string, exts: string | string[]): Promise<string[]> {
  const suffixes = Array.isArray(exts) ? exts : [exts]
  const out: string[] = []
  const walk = async (d: string) => {
    let entries
    try {
      entries = await fs.readdir(d, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      const full = path.join(d, entry.name)
      if (entry.isDirectory()) await walk(full)
      else if (suffixes.some((ext) => entry.name.endsWith(ext))) out.push(full)
    }
  }
  await walk(dir)
  return out
}

async function readSources(
  root: string,
  dir: string,
  exts: string | string[]
): Promise<SourceFile[]> {
  const files = await listFiles(path.join(root, dir), exts)
  return Promise.all(
    files.map(async (file) => ({
      path: path.relative(root, file),
      source: await fs.readFile(file, "utf8"),
    }))
  )
}

export function fsSources(
  root: string,
  options: { componentDir?: string; extraComponentDirs?: string[]; scanDir?: string } = {}
): SourceStore {
  const componentDir = options.componentDir ?? "src/components"
  const dirs = [componentDir, ...(options.extraComponentDirs ?? [])]
  const scanDir = options.scanDir ?? "src"
  return {
    componentFiles: async () => {
      const batches = await Promise.all(dirs.map((dir) => readSources(root, dir, ".tsx")))
      return batches.flat()
    },
    // .ts included so checked extraction can reach imported type modules;
    // the usage scan only pattern-matches JSX so plain .ts files are inert.
    scanFiles: () => readSources(root, scanDir, [".tsx", ".ts"]),
    root: () => root,
  }
}

export function fsManifest(root: string): ManifestStore {
  const file = path.join(root, STEER_DIR, "manifest.json")
  return {
    read: async () => {
      try {
        return JSON.parse(await fs.readFile(file, "utf8")) as SteerManifest
      } catch {
        return undefined
      }
    },
    write: async (manifest) => {
      const dir = path.join(root, STEER_DIR)
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
      await fs.writeFile(file, JSON.stringify(manifest, null, 2))
    },
  }
}

export function fsFixtures(root: string): FixtureStore {
  const dir = path.join(root, STEER_DIR, "fixtures")
  return {
    readRaw: async (slug) => {
      try {
        return await fs.readFile(path.join(dir, `${slug}.json`), "utf8")
      } catch {
        return undefined
      }
    },
    list: async () =>
      (await listFiles(dir, ".json")).map((f) => path.basename(f, ".json")),
  }
}

export function fsNotes(root: string): NoteStore {
  const dir = path.join(root, STEER_DIR, "notes")
  return {
    read: async (slug) => {
      try {
        const raw = JSON.parse(
          await fs.readFile(path.join(dir, `${slug}.json`), "utf8")
        ) as SteerNote[]
        return migrateNotes(raw)
      } catch {
        return []
      }
    },
    write: async (slug, notes) => {
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
      await fs.writeFile(path.join(dir, `${slug}.json`), JSON.stringify(notes, null, 2))
    },
    list: async () =>
      (await listFiles(dir, ".json")).map((f) => path.basename(f, ".json")),
  }
}
