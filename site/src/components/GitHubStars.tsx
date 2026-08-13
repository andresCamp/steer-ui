import { createSignal, onMount, Show } from "solid-js"
import { Star } from "lucide-solid"

export interface GitHubStarsProps {
  /** owner/repo the count is read from and the link points at. */
  repo?: string
}

/**
 * The unauthenticated API allows 60 calls an hour per IP, and a visitor
 * behind a shared address can arrive at an exhausted bucket. So the last
 * good count is kept, shown immediately on the next visit, and left standing
 * when a request fails. A count inside the window is trusted as-is, which
 * also stops repeated reloads from spending the budget in the first place.
 */
const CACHE_TTL = 60 * 60 * 1000

interface Cached {
  count: number
  at: number
}

function readCache(key: string): Cached | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const value = JSON.parse(raw) as Cached
    return typeof value?.count === "number" ? value : null
  } catch {
    return null
  }
}

function writeCache(key: string, count: number): void {
  try {
    localStorage.setItem(key, JSON.stringify({ count, at: Date.now() }))
  } catch {
    /* a blocked store just means no cache, never a crash */
  }
}

/** Live star count off the public API; the last known count until it answers. */
export function GitHubStars(props: GitHubStarsProps) {
  const repo = () => props.repo ?? "andresCamp/steer-ui"
  const [stars, setStars] = createSignal<number | null>(null)

  onMount(() => {
    const key = `steerui:gh-stars:${repo()}`
    const cached = readCache(key)
    // Paint the known count first, so a slow or failed request never blanks it.
    if (cached) setStars(cached.count)
    if (cached && Date.now() - cached.at < CACHE_TTL) return

    fetch(`https://api.github.com/repos/${repo()}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.stargazers_count != null) {
          setStars(data.stargazers_count)
          writeCache(key, data.stargazers_count)
        }
      })
      .catch(() => {})
  })

  const label = () => {
    const n = stars()
    if (n == null) return ""
    return n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k` : String(n)
  }

  return (
    <a
      href={`https://github.com/${repo()}`}
      target="_blank"
      rel="noopener noreferrer"
      data-steer="GitHubStars"
      aria-label={`${repo()} on GitHub`}
      class="refines inline-flex items-center gap-2 rounded-full px-2 py-1.5 text-[15px] sm:px-3 text-zinc-500 transition-colors hover:bg-black/[0.04] hover:text-zinc-900"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" class="h-[18px] w-[18px] fill-current">
        <path d="M12 .5C5.73.5.5 5.73.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.56 0-.28-.01-1.02-.02-2-3.2.7-3.88-1.54-3.88-1.54-.52-1.34-1.28-1.69-1.28-1.69-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11 11 0 0 1 2.9-.39c.98 0 1.97.13 2.9.39 2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.12 3.05.74.8 1.18 1.83 1.18 3.09 0 4.42-2.69 5.39-5.25 5.68.41.36.78 1.06.78 2.14 0 1.55-.01 2.79-.01 3.17 0 .31.21.67.8.56A11.51 11.51 0 0 0 23.5 12C23.5 5.73 18.27.5 12 .5Z" />
      </svg>
      {/* The slot is reserved before the count lands, so the target never moves.
          A phone nav has no room for a four-digit slot; it reserves what a
          plausible count needs and no more. */}
      <span class="flex min-w-8 items-center gap-1.5 sm:min-w-[3.25rem]">
        <Show when={stars() !== null}>
          <Star class="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
          <span class="tabular-nums">{label()}</span>
        </Show>
      </span>
    </a>
  )
}
