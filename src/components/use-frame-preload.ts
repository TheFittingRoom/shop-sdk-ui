import { useEffect, useRef, useState } from 'react'

// How many decoded frame images to retain across outfit changes. Retaining an
// HTMLImageElement mainly keeps its *encoded* bytes resident (browsers discard
// and re-decode bitmaps under memory pressure on their own), so at JPEG frame
// sizes this cache is well under a megabyte per outfit — cheap enough to keep
// a few recent outfits warm so flipping back to a previous size or colour is
// instant. Oldest-first eviction; Map preserves insertion order.
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

    // Evict oldest entries beyond the cap, but never anything in the current
    // set — those are the frames actively being displayed.
    if (retained.size > MAX_RETAINED_FRAMES) {
      const current = new Set(frameUrls)
      for (const url of retained.keys()) {
        if (retained.size <= MAX_RETAINED_FRAMES) {
          break
        }
        if (!current.has(url)) {
          retained.delete(url)
        }
      }
    }

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
