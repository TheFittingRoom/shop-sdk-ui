import type { Dispatch, SetStateAction } from 'react'
import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'

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
// The intended use is "play a fresh rotation when a new product is added to
// the VTO outfit" — parents bump `trigger` on that event only, so size/color
// changes (which replace frameUrls but don't bump the trigger) are ignored.
//
// WHERE THE ROTATION STARTS AND ENDS ("the anchor"):
//
//   * Frame 0 (front-facing) until the shopper moves the frame themselves.
//   * Afterwards, whichever frame they settled on — so someone who spun the
//     avatar around to look at the back, then adds another product, sees the
//     new outfit spin past and settle on that same back view.
//
// The second half was the original design; the first half fixes a wrinkle in
// it. The anchor used to be simply "whatever index is displayed when the
// trigger fires". Change the outfit *during* a rotation and that index is
// wherever the animation had got to — so a shopper who never touched the
// spin controls could be left parked at a side or back view, having done
// nothing to ask for it.
//
// The distinction is carried by `cancelAutoRotate` (below), which every
// frame-moving surface must call: it both halts the rotation and marks the
// frame as the shopper's to choose. A rotation that ends by itself must NOT
// go through it, or the avatar would anchor to wherever the last animation
// stopped.
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

  // The trigger of the rotation currently playing, or undefined when idle.
  // Distinguishes "finished / user took over" from "torn down mid-flight",
  // which need opposite handling — see the effect cleanup.
  const playingRef = useRef<number | undefined>(undefined)

  // Has the shopper ever moved the frame themselves? Until they have, every
  // rotation starts and ends at frame 0; afterwards it starts and ends at
  // whichever frame they settled on. See the anchor discussion on the hook.
  const userControlledRef = useRef(false)
  // The frame the shopper last settled on. Only meaningful once
  // userControlledRef is true.
  const anchorRef = useRef<number | null>(null)

  useEffect(() => {
    indexRef.current = selectedFrameIndex
    // Record the resting frame, but only while nothing is playing: mid-
    // rotation the index belongs to the animation, not the shopper. This is
    // what keeps an outfit change *during* a rotation from adopting whatever
    // angle the animation happened to be passing through.
    if (playingRef.current === undefined && userControlledRef.current) {
      anchorRef.current = selectedFrameIndex
    }
  }, [selectedFrameIndex])

  // Stop the animation. Internal: used by completion and teardown, neither of
  // which implies the shopper took over.
  const stopRotation = useCallback(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current)
      rafIdRef.current = null
    }
    playingRef.current = undefined
  }, [])

  // Handed to every surface that lets the shopper move the frame. Stops the
  // rotation AND records that the frame is now theirs to choose — the index
  // they land on becomes the anchor for subsequent rotations. Distinct from
  // stopRotation for exactly that reason: a rotation ending on its own must
  // not be mistaken for the shopper taking control.
  const cancelAutoRotate = useCallback(() => {
    userControlledRef.current = true
    stopRotation()
  }, [stopRotation])

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

  // Front-facing by default; the shopper's chosen angle once they have moved
  // the frame themselves. Shared by the snap below and the rotation itself so
  // the two can never disagree about where a rotation belongs.
  const anchorFrame = useCallback(() => {
    if (frameCount === 0) {
      return 0
    }
    const anchor = userControlledRef.current ? (anchorRef.current ?? 0) : 0
    // Clamped in case the new outfit has fewer frames than the anchor —
    // otherwise the rotation's stop condition could never match.
    return anchor % frameCount
  }, [frameCount])

  // Snap to the anchor the moment a new frame set is available, and do it in a
  // LAYOUT effect so it lands before the browser paints.
  //
  // The rotation itself can't do this: it waits for the frame set to finish
  // decoding, and a plain effect runs after paint. Either way the new outfit
  // gets painted at whatever index the previous one was left on and then jumps
  // — visibly, and to an unrelated angle. Snapping here means the first paint
  // of a new outfit is already the angle the rotation will start from.
  //
  // Gated on a pending trigger, so it only applies to an outfit *change*. A
  // size or colour swap replaces frameUrls without bumping the trigger and
  // deliberately holds the current angle, which is what makes comparing sizes
  // at the same view possible.
  const frameKey = frameUrls ? frameUrls.join('|') : ''
  useLayoutEffect(() => {
    const pending = pendingTriggerRef.current
    if (pending === undefined || pending === lastFiredRef.current || frameCount === 0) {
      return
    }
    const anchor = anchorFrame()
    if (indexRef.current !== anchor) {
      // Update the ref synchronously too: the rotation reads it, and the
      // state update has not committed yet.
      indexRef.current = anchor
      setSelectedFrameIndex(anchor)
    }
    // frameKey rather than the frameUrls reference: the array is rebuilt on
    // every render by framesForOutfit, but the joined key is stable for the
    // same set, so this fires on an actual change of frames and not on
    // background prefetch landings.
  }, [frameKey, frameCount, anchorFrame, setSelectedFrameIndex])

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
      // Deliberately NOT the currently-displayed index: when an outfit changes
      // mid-rotation that index is wherever the animation had got to, so using
      // it let a shopper who never touched the controls end up parked at a
      // back or side view. The layout effect above has normally already
      // snapped the display to this same frame.
      const startFrameIndex = anchorFrame()
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
            stopRotation()
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
      stopRotation()
    }
  }, [trigger, frameCount, framesReady, anchorFrame, setSelectedFrameIndex, stopRotation])

  return cancelAutoRotate
}
