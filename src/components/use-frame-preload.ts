import { useEffect, useRef, useState } from 'react'

// How many recently-viewed outfits to keep warm, so flipping back to a
// previously-viewed size or colour is instant.
//
// Counted in whole outfits, not images. An image-count cap was tried and
// removed: because eviction works on whole sets anyway, a frame budget only
// changes *how many* sets survive, and it does so invisibly — at a flat 64
// images this held 7 outfits at 9 frames per outfit but only 4 at 16. That is
// the same silent coupling to the renderer's frame count that counting sets
// was meant to eliminate, so having both knobs was worse than having one.
//
// Sizing: retaining an HTMLImageElement keeps its *encoded* bytes resident
// (the decoded bitmap is the browser's to discard and re-decode under
// pressure). Per 1000x1500 frame that is ~70 KB as JPEG q80, so 6 outfits of
// 16 frames is ~6.6 MB — comfortably cheap, which is the case this number is
// chosen for. Frames rendered as PNG are ~1081 KB each, making the same
// 6x16 ~101 MB; that is the transitional cost until sim-vis ships JPEG, and
// it degrades softly (the browser evicts, frames re-fetch) rather than
// failing. Revisit this number if frames ever get large again.
const MAX_RETAINED_SETS = 6

// One outfit's retained frames. The urls are kept alongside the images rather
// than recovered from the map key (which is them join('|')-ed) or read back off
// img.src — both work today but bake in assumptions about delimiters and URL
// normalisation that this doesn't need.
interface RetainedSet {
  urls: string[]
  images: HTMLImageElement[]
}

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
  // frameKey -> that outfit's retained images, in least-recently-used order
  // (Map preserves insertion order, and re-visiting a set re-inserts it at the
  // end). Each set owns its images outright: frame URLs are unique per set —
  // a VTO path embeds the composition's content hash (`.../vto-{token}/...`)
  // and the bare-avatar path has no token segment at all — so two distinct
  // sets can never name the same image, and evicting a set can never strand
  // one that another set still needs.
  //
  // A ref, not state: mutating it must not re-render, and the whole point is
  // that these objects outlive any single render.
  const retainedSetsRef = useRef<Map<string, RetainedSet>>(new Map())
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
    const sets = retainedSetsRef.current

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

    const existing = sets.get(frameKey)
    if (existing) {
      // Already retained. Move to most-recently-used so the outfit on screen
      // is never the next one evicted, and re-mark its frames settled — a
      // previous eviction may have pruned them from settledUrls.
      sets.delete(frameKey)
      sets.set(frameKey, existing)
      existing.images.forEach((img, i) => {
        if (img.complete) {
          markSettled(existing.urls[i])
        }
      })
      return () => {
        cancelled = true
      }
    }

    const images = frameUrls.map((url) => {
      const img = new Image()
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
      return img
    })
    sets.set(frameKey, { urls: [...frameUrls], images })

    // Evict whole outfits, oldest first. Whole sets because a half-retained
    // outfit is worse than none: the readiness gate would still block on the
    // frames that were dropped.
    while (sets.size > MAX_RETAINED_SETS) {
      const oldestKey = sets.keys().next().value
      // The current set is never evicted — it is the one being displayed.
      // It was just re-inserted, so it is last in iteration order and can
      // only come up here if it is the only set left.
      if (oldestKey === undefined || oldestKey === frameKey) {
        break
      }
      sets.delete(oldestKey)
    }

    // settledUrls would otherwise grow without bound as outfits come and go.
    // Prune it to the URLs still retained.
    setSettledUrls((prev) => {
      const live = new Set<string>()
      for (const set of sets.values()) {
        for (const url of set.urls) {
          live.add(url)
        }
      }
      if (prev.size <= live.size) {
        return prev
      }
      const next = new Set<string>()
      for (const url of prev) {
        if (live.has(url)) {
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
