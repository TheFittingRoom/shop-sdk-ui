import type { Dispatch, SetStateAction } from 'react'
import { useCallback, useEffect, useRef } from 'react'

// Total time for one full rotation, regardless of how many frames the VTO
// renderer returns. Per-frame tick is derived as duration / frameCount, so a
// 6-frame product and a 24-frame product both complete in the same wall-clock
// time (and shorter frame sets just feel less granular).
const AUTO_ROTATE_DURATION_MS = 4000

// How long to wait for the frame set to finish decoding before playing the
// rotation anyway. The gate exists so the spin doesn't run against undecoded
// frames, but it must not be able to suppress the rotation outright — a single
// frame that never settles (blocked request, decode failure the preloader
// didn't observe) would otherwise mean the shopper never sees a spin at all.
const READINESS_TIMEOUT_MS = 3000

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
// `framesReady` gates the start of the rotation on the frame set being
// decoded (see useFramePreload). Without it the rotation advances its index
// on schedule while the <img> keeps painting the last frame it managed to
// decode — the "auto-spin didn't happen" / "image-swap timing is broken"
// reports in WEB-12. Pass `true` when there is nothing to wait on.
//
// Hosted on the *parent* of AvatarFrameViewer (Avatar in quick-view,
// AvatarPane in fitting-room) — the viewer unmounts during loading
// transitions in fitting-room, which would reset any ref state living inside
// it and cause false fires on remount.
//
// Returns `cancelAutoRotate` — call it from any code path that lets the user
// manually move the frame (chevron taps, drag, the zoom modal) to halt the
// in-flight rotation. The previous "detect cancellation by comparing prev
// state inside the setter" approach was broken under React 18's deferred-
// updater batching: the updater runs asynchronously, so side-effects mutated
// inside it weren't visible to code outside the setter, and the very first
// tick saw stale `nextFrameIndex = 0` and immediately stopped thinking it had
// wrapped. Explicit cancellation removes the race entirely.
export function useAutoRotate(
  trigger: number | undefined,
  frameUrls: string[] | null | undefined,
  selectedFrameIndex: number | null,
  setSelectedFrameIndex: Dispatch<SetStateAction<number | null>>,
  framesReady = true,
): () => void {
  const lastFiredRef = useRef<number | undefined>(undefined)
  // Handle for the active rAF loop so the cancel callback (and the effect's
  // cleanup) can stop it from outside any single run's closure.
  const rafIdRef = useRef<number | null>(null)
  // Mirror selectedFrameIndex into a ref so the rotation effect can capture
  // the "currently displayed frame" at fire time without including the index
  // in the effect's dep array — which would tear down and rebuild the
  // animation every single tick.
  const indexRef = useRef<number | null>(selectedFrameIndex)
  useEffect(() => {
    indexRef.current = selectedFrameIndex
  }, [selectedFrameIndex])

  // The trigger of the rotation currently playing, or undefined when idle.
  // Distinguishes "finished / user took over" from "torn down mid-flight",
  // which need opposite handling — see the effect cleanup.
  const playingRef = useRef<number | undefined>(undefined)

  const cancelAutoRotate = useCallback(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current)
      rafIdRef.current = null
    }
    // A completed rotation, or the user taking manual control. Either way the
    // rotation is done with — it must not be replayed.
    playingRef.current = undefined
  }, [])

  // Depend on the frame *count* rather than the frameUrls array reference.
  // Background prefetch landings update an upstream `framesByKey` map which
  // rebuilds `framesForOutfit` (and therefore frameUrls's reference) every
  // few hundred ms; depending on the reference would re-run this effect on
  // each landing and kill the in-progress rotation. Length is stable for the
  // same outfit, which is the only signal we need here.
  const frameCount = frameUrls?.length ?? 0

  // Once a rotation has been requested, remember it until it actually plays.
  // The readiness gate means firing is deferred, and `trigger` alone can't
  // carry that intent across the re-render that flips framesReady.
  const pendingTriggerRef = useRef<number | undefined>(undefined)
  if (trigger !== undefined && trigger !== lastFiredRef.current) {
    pendingTriggerRef.current = trigger
  }

  useEffect(() => {
    const pending = pendingTriggerRef.current
    if (pending === undefined || pending === lastFiredRef.current) {
      return
    }
    if (frameCount === 0) {
      return
    }

    let timeoutId: ReturnType<typeof setTimeout> | null = null

    const play = () => {
      // Claim the trigger only once the rotation actually starts. A rotation
      // that never started (frames absent, component torn down) must be able
      // to fire later rather than being silently consumed.
      lastFiredRef.current = pending
      pendingTriggerRef.current = undefined
      playingRef.current = pending

      const tickMs = AUTO_ROTATE_DURATION_MS / frameCount
      // Start (and stop) at whichever frame is currently displayed. Clamped to
      // frameCount in case the new outfit has fewer frames than the previous
      // selection — otherwise the stop condition could never match.
      const startFrameIndex = (indexRef.current ?? 0) % frameCount
      const startedAt = performance.now()
      let lastStep = 0

      // rAF rather than setInterval: the step is derived from elapsed time, so
      // a slow frame can't accumulate drift, and the loop stops on its own in
      // a backgrounded tab instead of queueing a burst of catch-up ticks that
      // would flash the avatar through several frames on return.
      const step = (now: number) => {
        const elapsedSteps = Math.floor((now - startedAt) / tickMs)
        if (elapsedSteps > lastStep) {
          lastStep = elapsedSteps
          if (elapsedSteps >= frameCount) {
            // Completed a full cycle — settle back on the start frame.
            setSelectedFrameIndex(startFrameIndex)
            cancelAutoRotate()
            return
          }
          setSelectedFrameIndex((startFrameIndex + elapsedSteps) % frameCount)
        }
        rafIdRef.current = requestAnimationFrame(step)
      }
      rafIdRef.current = requestAnimationFrame(step)
    }

    if (framesReady) {
      play()
    } else {
      // Frames are still decoding. Wait, but not indefinitely.
      timeoutId = setTimeout(play, READINESS_TIMEOUT_MS)
    }

    return () => {
      if (timeoutId !== null) {
        clearTimeout(timeoutId)
      }
      // Torn down while still playing — the frame set changed underneath the
      // rotation (frameCount is a dependency). Hand the trigger back so the
      // next run replays it instead of leaving the avatar stranded on an
      // arbitrary mid-rotation frame. Previously the trigger was consumed on
      // the first tick, so this teardown killed the rotation permanently and
      // it could never re-fire: one of the "auto-spin doesn't always happen"
      // reports in WEB-12.
      if (playingRef.current !== undefined) {
        pendingTriggerRef.current = playingRef.current
        lastFiredRef.current = undefined
      }
      cancelAutoRotate()
    }
  }, [trigger, frameCount, framesReady, setSelectedFrameIndex, cancelAutoRotate])

  return cancelAutoRotate
}
