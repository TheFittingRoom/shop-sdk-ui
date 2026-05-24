import type { Dispatch, SetStateAction } from 'react'
import { useCallback, useEffect, useRef } from 'react'

// Total time for one full rotation, regardless of how many frames the VTO
// renderer returns. Per-frame tick is derived as duration / frameCount, so a
// 6-frame product and a 24-frame product both complete in the same wall-clock
// time (and shorter frame sets just feel less granular).
const AUTO_ROTATE_DURATION_MS = 4000

// useAutoRotate plays one full rotation through `frameUrls` each time
// `trigger` changes from its previous fired value AND frames are present.
// The rotation starts AND ends at whichever frame index is currently
// selected at the moment trigger advances — so a shopper who rotated the
// avatar to a particular angle and then adds another product sees the new
// outfit spin past that same angle and settle back on it. The intended use
// is "play a fresh rotation when a new product is added to the VTO outfit"
// — parents bump `trigger` on that event only, so size/color changes
// (which replace frameUrls but don't bump the trigger) are ignored.
//
// `trigger` is `undefined` when auto-rotate is dormant (e.g. the fitting-room
// bare-avatar state before any product has been added). Bumping to any number
// from undefined counts as a change and fires once; subsequent re-fires
// require the number to differ from the last-fired value.
//
// Hosted on the *parent* of AvatarFrameViewer (Avatar in quick-view,
// AvatarPane in fitting-room) — the viewer unmounts during loading
// transitions in fitting-room, which would reset any ref state living inside
// it and cause false fires on remount.
//
// Returns `cancelAutoRotate` — call it from any code path that lets the user
// manually move the frame (chevron taps, drag) to halt the in-flight
// rotation. The previous "detect cancellation by comparing prev state inside
// the setter" approach was broken under React 18's deferred-updater batching:
// the updater runs asynchronously, so side-effects mutated inside it weren't
// visible to code outside the setter, and the very first tick saw stale
// `nextFrameIndex = 0` and immediately cleared the interval thinking it had
// wrapped. Explicit cancellation removes the race entirely.
export function useAutoRotate(
  trigger: number | undefined,
  frameUrls: string[] | null | undefined,
  selectedFrameIndex: number | null,
  setSelectedFrameIndex: Dispatch<SetStateAction<number | null>>,
): () => void {
  const lastFiredRef = useRef<number | undefined>(undefined)
  // Mutable handle to the active interval so the cancel callback (and the
  // effect's cleanup) can stop it even though they live outside the effect's
  // closure of any specific run.
  const intervalIdRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // Mirror selectedFrameIndex into a ref so the rotation effect can capture
  // the "currently displayed frame" at fire time without including the index
  // in the effect's dep array — which would tear down and rebuild the
  // interval every single tick (the rotation calls setSelectedFrameIndex on
  // each tick, so the value changes ~every 444 ms during play).
  const indexRef = useRef<number | null>(selectedFrameIndex)
  useEffect(() => {
    indexRef.current = selectedFrameIndex
  }, [selectedFrameIndex])

  const cancelAutoRotate = useCallback(() => {
    if (intervalIdRef.current !== null) {
      clearInterval(intervalIdRef.current)
      intervalIdRef.current = null
    }
  }, [])

  // Depend on the frame *count* rather than the frameUrls array reference.
  // Background prefetch landings update an upstream `framesByKey` map which
  // rebuilds `framesForOutfit` (and therefore frameUrls's reference) every
  // few hundred ms; depending on the reference would re-run this effect on
  // each landing and kill the in-progress rotation. Length is stable for the
  // same outfit, which is the only signal we need here.
  const frameCount = frameUrls?.length ?? 0
  useEffect(() => {
    if (trigger === undefined) {
      return
    }
    if (frameCount === 0) {
      return
    }
    if (trigger === lastFiredRef.current) {
      return
    }
    // Don't record `lastFiredRef` until the interval actually fires its
    // first tick. React Strict Mode (dev) runs every effect twice on mount —
    // run → cleanup → run — and the cleanup happens synchronously before any
    // tick. If we recorded the trigger eagerly here, the second run would
    // see `trigger === lastFiredRef` and early-return, leaving the rotation
    // un-played. Recording on the first tick means a never-fired interval
    // (Strict Mode's first run) leaves the ref unchanged, so the second run
    // fires fresh and *that's* the interval that survives.
    const tickMs = Math.round(AUTO_ROTATE_DURATION_MS / frameCount)
    // Start (and stop) at whichever frame is currently displayed. Clamped to
    // frameCount in case the new outfit has fewer frames than the previous
    // selection — otherwise the stop condition could never match.
    const startFrameIndex = (indexRef.current ?? 0) % frameCount
    let currentFrameIndex = startFrameIndex
    let didFirstTick = false
    intervalIdRef.current = setInterval(() => {
      if (!didFirstTick) {
        didFirstTick = true
        lastFiredRef.current = trigger
      }
      const nextFrameIndex = (currentFrameIndex + 1) % frameCount
      currentFrameIndex = nextFrameIndex
      setSelectedFrameIndex(nextFrameIndex)
      if (nextFrameIndex === startFrameIndex) {
        // Completed a full cycle and settled back on the start frame.
        cancelAutoRotate()
      }
    }, tickMs)
    return cancelAutoRotate
  }, [trigger, frameCount, setSelectedFrameIndex, cancelAutoRotate])

  return cancelAutoRotate
}
