import { useEffect, useRef, useState } from 'react'

// The retention budget is expressed two ways, and the effective limit is
// whichever binds first.
//
// MAX_RETAINED_SETS is the one that describes intent: keep the last N *outfits*
// warm, so flipping back to a previously-viewed size or colour is instant. It
// is deliberately counted in sets rather than images — the old image-count cap
// silently shrank the warm cache whenever frames-per-outfit grew (at a flat 64
// images: 7.1 outfits at 9 frames, but only 4.0 at 16), so a renderer change
// would have quietly degraded this with nobody touching the constant.
//
// MAX_RETAINED_FRAMES is the memory ceiling, and it exists precisely so that a
// frames-per-outfit change cannot multiply memory behind our backs. Retaining
// an HTMLImageElement keeps its *encoded* bytes resident; the decoded bitmap is
// the browser's to discard and re-decode under pressure. At 1000x1500 that is:
//
//   encoded PNG  (current)      ~1081 KB/frame  ->  ~68 MB at 64 frames
//   encoded JPEG (sim-vis q80)    ~70 KB/frame  ->  ~4.4 MB at 64 frames
//   decoded RGBA (ceiling)       5.72 MiB/frame -> ~366 MiB at 64 frames
//
// 64 holds the ceiling at exactly today's figure while frames are still PNG.
// Once sim-vis ships JPEG the encoded cost drops ~15x and this can be raised
// (or dropped in favour of the set count alone) — at that point 8 sets of 16
// frames is only ~9 MB.
const MAX_RETAINED_SETS = 6
const MAX_RETAINED_FRAMES = 64

export interface FramePreloadState {
  // True once every frame in the current set has settled — decoded, or failed.
  // Failures count as settled on purpose: a broken frame must not wedge the
  // auto-rotate gate forever.
  allSettled: boolean
  settledCount: number
  totalCount: number
}

// useFramePreload fetches and decodes a frame set up front, and reports when
// it is ready to animate.
//
// Why this exists (WEB-12): the viewer swaps `src` on a single <img>, and a
// browser keeps painting the *previous* frame until the new one has decoded.
// So an un-preloaded rotation advances its index on schedule while the pixels
// barely change — which reads as "auto-spin didn't happen" or "the spin is
// janky", not as "the image is loading". There is no loading state to show
// because, as far as the DOM is concerned, an image is already displayed.
//
// Two things matter beyond firing off requests:
//   * `img.decode()` — waiting for load alone still leaves the decode cost on
//     the main thread at first paint, which is exactly the hitch being
//     reported. decode() resolves only when the frame can be painted cheaply.
//   * retaining the Image objects — the previous approach created
//     `new Image()` inside a useMemo and dropped the reference immediately,
//     leaving nothing but the HTTP cache to help. That made preloading only
//     as reliable as the cache headers, which were themselves broken.
export function useFramePreload(frameUrls: string[] | null | undefined): FramePreloadState {
  // url -> Image. A ref, not state: mutating it must not re-render, and the
  // whole point is that these objects outlive any single render.
  const retainedRef = useRef<Map<string, HTMLImageElement>>(new Map())
  // frameKey -> that set's urls, in least-recently-used order (Map preserves
  // insertion order, and re-visiting a set re-inserts it at the end). Eviction
  // works on whole sets so a partially-evicted outfit can't exist — half a
  // warm outfit is worse than none, since the gate would still wait on the
  // missing half.
  const retainedSetsRef = useRef<Map<string, string[]>>(new Map())
  const [settledUrls, setSettledUrls] = useState<Set<string>>(() => new Set())

  // Depend on the joined URLs rather than the array reference: framesForOutfit
  // rebuilds its array on every call, so keying on identity would restart the
  // preload continuously.
  const frameKey = frameUrls ? frameUrls.join('|') : ''

  useEffect(() => {
    if (!frameUrls || frameUrls.length === 0) {
      return
    }

    let cancelled = false
    const retained = retainedRef.current

    const markSettled = (url: string) => {
      if (cancelled) {
        return
      }
      setSettledUrls((prev) => {
        if (prev.has(url)) {
          return prev
        }
        const next = new Set(prev)
        next.add(url)
        return next
      })
    }

    for (const url of frameUrls) {
      const existing = retained.get(url)
      if (existing) {
        // Already retained. Re-mark it settled: this set may have been
        // evicted from settledUrls by a previous outfit's cleanup.
        if (existing.complete) {
          markSettled(url)
        }
        continue
      }

      const img = new Image()
      retained.set(url, img)
      img.src = url

      // decode() rejects on a decode failure AND on some browsers when the
      // element is not yet in a decodable state; either way the frame is
      // "settled" for gating purposes and the <img> in the viewer will retry
      // on its own. Older Safari lacks decode() — fall back to load events.
      if (typeof img.decode === 'function') {
        img.decode().then(
          () => markSettled(url),
          () => markSettled(url),
        )
      } else {
        img.onload = () => markSettled(url)
        img.onerror = () => markSettled(url)
      }
    }

    // Mark this set most-recently-used: delete-then-set moves it to the end of
    // the Map's insertion order, which is what makes eviction LRU rather than
    // first-in-first-out. Without this, returning to an earlier outfit would
    // leave it queued for eviction despite being the one on screen.
    const sets = retainedSetsRef.current
    sets.delete(frameKey)
    sets.set(frameKey, [...frameUrls])

    // Evict whole sets, oldest first, until both budgets are satisfied. The
    // current set is never evicted — it is the one being displayed — so the
    // loop stops at a single remaining set even if that set alone exceeds
    // MAX_RETAINED_FRAMES (a 100-frame outfit must still work).
    const evictOldestSet = () => {
      const oldest = sets.keys().next()
      if (oldest.done || oldest.value === frameKey) {
        return false
      }
      sets.delete(oldest.value)
      // Only drop images no surviving set still needs. Sets normally have
      // disjoint urls (the VTO token differs per composition), but the bare
      // avatar frames are shared, so checking is not merely defensive.
      const stillNeeded = new Set<string>()
      for (const urls of sets.values()) {
        for (const url of urls) {
          stillNeeded.add(url)
        }
      }
      for (const url of retained.keys()) {
        if (!stillNeeded.has(url)) {
          retained.delete(url)
        }
      }
      return true
    }

    while ((sets.size > MAX_RETAINED_SETS || retained.size > MAX_RETAINED_FRAMES) && evictOldestSet()) {
      // evictOldestSet returns false once only the current set remains.
    }

    // settledUrls would otherwise grow without bound as outfits come and go.
    // Prune it to what is actually retained.
    setSettledUrls((prev) => {
      if (prev.size <= retained.size) {
        return prev
      }
      const next = new Set<string>()
      for (const url of prev) {
        if (retained.has(url)) {
          next.add(url)
        }
      }
      return next
    })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frameKey])

  const totalCount = frameUrls?.length ?? 0
  let settledCount = 0
  if (frameUrls) {
    for (const url of frameUrls) {
      if (settledUrls.has(url)) {
        settledCount++
      }
    }
  }

  return {
    allSettled: totalCount > 0 && settledCount === totalCount,
    settledCount,
    totalCount,
  }
}
