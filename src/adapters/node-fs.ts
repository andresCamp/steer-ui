import { promises as fs } from "node:fs"
import { existsSync, mkdirSync } from "node:fs"
import path from "node:path"
import type { FixtureStore, ManifestStore, NoteStore, SourceStore } from "../ports"
import type { BenchManifest, BenchNote, SourceFile } from "../core/model"

// Filesystem adapters: the real stores behind a host's .bench/ directory
// and source tree. Everything the pure core needs, nothing more.

const BENCH_DIR = ".bench"

async function listFiles(dir: string, ext: string): Promise<string[]> {
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
      else if (entry.name.endsWith(ext)) out.push(full)
    }
  }
  await walk(dir)
  return out
}

async function readSources(root: string, dir: string, ext: string): Promise<SourceFile[]> {
  const files = await listFiles(path.join(root, dir), ext)
  return Promise.all(
    files.map(async (file) => ({
      path: path.relative(root, file),
      source: await fs.readFile(file, "utf8"),
    }))
  )
}

export function fsSources(
  root: string,
  options: { componentDir?: string; scanDir?: string } = {}
): SourceStore {
  const componentDir = options.componentDir ?? "src/components"
  const scanDir = options.scanDir ?? "src"
  return {
    componentFiles: () => readSources(root, componentDir, ".tsx"),
    scanFiles: () => readSources(root, scanDir, ".tsx"),
    root: () => root,
  }
}

export function fsManifest(root: string): ManifestStore {
  const file = path.join(root, BENCH_DIR, "manifest.json")
  return {
    read: async () => {
      try {
        return JSON.parse(await fs.readFile(file, "utf8")) as BenchManifest
      } catch {
        return undefined
      }
    },
    write: async (manifest) => {
      const dir = path.join(root, BENCH_DIR)
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
      await fs.writeFile(file, JSON.stringify(manifest, null, 2))
    },
  }
}

export function fsFixtures(root: string): FixtureStore {
  const dir = path.join(root, BENCH_DIR, "fixtures")
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
  const dir = path.join(root, BENCH_DIR, "notes")
  return {
    read: async (slug) => {
      try {
        return JSON.parse(await fs.readFile(path.join(dir, `${slug}.json`), "utf8")) as BenchNote[]
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
