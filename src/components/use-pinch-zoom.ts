import type { TouchEvent as ReactTouchEvent } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'

const MAX_SCALE = 4
// Pinching back to within this of 1× snaps out of zoom entirely, so the
// shopper doesn't have to land exactly on 1× to get rid of the zoom.
const SNAP_OUT_SCALE = 1.05
// Two taps this close together, in time and space, reset the zoom.
const DOUBLE_TAP_MS = 300
const DOUBLE_TAP_PX = 24
// Finger travel that turns a tap into a pan.
const TAP_SLOP_PX = 8

export interface ZoomState {
  scale: number
  // Translation of the image's top-left corner, in px, applied after scale.
  x: number
  y: number
}

const UNZOOMED: ZoomState = { scale: 1, x: 0, y: 0 }

interface Point {
  x: number
  y: number
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

// Keep the zoomed image covering its own box: it may not be panned so far
// that an edge comes away from the box's edge and shows the background.
function clamp(state: ZoomState, width: number, height: number): ZoomState {
  const scale = Math.min(MAX_SCALE, Math.max(1, state.scale))
  const minX = width * (1 - scale)
  const minY = height * (1 - scale)
  return {
    scale,
    x: Math.min(0, Math.max(minX, state.x)),
    y: Math.min(0, Math.max(minY, state.y)),
  }
}

export interface PinchZoomHandle {
  zoom: ZoomState
  zoomed: boolean
  // Call from the image's touchstart. Returns true when the touch belongs to
  // the zoom — a pinch, or a pan/tap while zoomed — and the caller must not
  // start its own gesture (frame rotation) for it.
  handleTouchStart: (e: ReactTouchEvent<HTMLElement>) => boolean
}

// usePinchZoom adds two-finger pinch-zoom to an image, with one-finger pan
// and double-tap reset while zoomed. The caller renders `zoom` as a CSS
// transform on the image (transform-origin 0 0) and clips the image's box.
//
// Gestures are tracked on window listeners for the rest of the touch, like
// useFrameRotation's drag: a pinch routinely ends with fingers off the image.
// Touchmove listeners are non-passive so preventDefault can stop the page
// pinch-zooming or scrolling under the gesture.
//
// `resetKey` resets the zoom when it changes — a new set of frames is a new
// image, and a zoom carried over onto it would land somewhere arbitrary.
export function usePinchZoom(onUserInteract?: () => void, resetKey?: unknown): PinchZoomHandle {
  const [zoom, setZoom] = useState<ZoomState>(UNZOOMED)
  const zoomRef = useRef<ZoomState>(UNZOOMED)
  const lastTapRef = useRef<{ at: number; point: Point } | null>(null)
  // While a gesture is under way: restarts it from the fingers now down.
  // Each finger that lands fires its own touchstart on the image, so a
  // second finger arriving must turn the current gesture into a pinch, not
  // start a second one.
  const restartRef = useRef<((touches: React.TouchList) => void) | null>(null)

  const apply = useCallback((next: ZoomState) => {
    zoomRef.current = next
    setZoom(next)
  }, [])

  useEffect(() => {
    apply(UNZOOMED)
  }, [resetKey, apply])

  const handleTouchStart = useCallback(
    (e: ReactTouchEvent<HTMLElement>): boolean => {
      const restart = restartRef.current
      if (restart) {
        restart(e.touches)
        return true
      }
      const target = e.currentTarget
      const isZoomed = zoomRef.current.scale > 1
      if (e.touches.length < 2 && !isZoomed) {
        return false
      }
      onUserInteract?.()

      // The image's untransformed box, in viewport coordinates. offset* are
      // layout values, unaffected by the transform we apply.
      const parentRect = target.offsetParent?.getBoundingClientRect()
      const boxLeft = (parentRect?.left ?? 0) + target.offsetLeft
      const boxTop = (parentRect?.top ?? 0) + target.offsetTop
      const width = target.offsetWidth
      const height = target.offsetHeight
      const local = (t: Touch | React.Touch): Point => ({ x: t.clientX - boxLeft, y: t.clientY - boxTop })

      type Gesture =
        | { kind: 'pinch'; startDistance: number; startMid: Point; start: ZoomState }
        | { kind: 'pan'; startPoint: Point; start: ZoomState; moved: boolean }

      const begin = (touches: TouchList | React.TouchList): Gesture => {
        if (touches.length >= 2) {
          const a = local(touches[0])
          const b = local(touches[1])
          return { kind: 'pinch', startDistance: distance(a, b), startMid: midpoint(a, b), start: zoomRef.current }
        }
        return { kind: 'pan', startPoint: local(touches[0]), start: zoomRef.current, moved: false }
      }
      let gesture = begin(e.touches)
      restartRef.current = (touches) => {
        gesture = begin(touches)
      }

      const onMove = (move: TouchEvent) => {
        move.preventDefault()
        if (gesture.kind === 'pinch') {
          if (move.touches.length < 2) {
            return
          }
          const a = local(move.touches[0])
          const b = local(move.touches[1])
          const { start, startDistance, startMid } = gesture
          const scale = start.scale * (distance(a, b) / Math.max(1, startDistance))
          // Keep the image point that was under the fingers' midpoint under
          // their current midpoint — zoom and pan in one motion.
          const anchorX = (startMid.x - start.x) / start.scale
          const anchorY = (startMid.y - start.y) / start.scale
          const mid = midpoint(a, b)
          apply(clamp({ scale, x: mid.x - anchorX * scale, y: mid.y - anchorY * scale }, width, height))
          return
        }
        const point = local(move.touches[0])
        const dx = point.x - gesture.startPoint.x
        const dy = point.y - gesture.startPoint.y
        if (!gesture.moved && Math.hypot(dx, dy) < TAP_SLOP_PX) {
          return
        }
        gesture.moved = true
        apply(clamp({ ...gesture.start, x: gesture.start.x + dx, y: gesture.start.y + dy }, width, height))
      }

      const onEnd = (end: TouchEvent) => {
        if (end.touches.length > 0) {
          // One finger lifted mid-pinch: carry on as a pan with the one still
          // down, from where the pinch left the image.
          gesture = begin(end.touches)
          return
        }
        restartRef.current = null
        window.removeEventListener('touchmove', onMove)
        window.removeEventListener('touchend', onEnd)
        window.removeEventListener('touchcancel', onEnd)
        if (zoomRef.current.scale < SNAP_OUT_SCALE) {
          apply(UNZOOMED)
          return
        }
        if (gesture.kind === 'pan' && !gesture.moved) {
          const now = Date.now()
          const last = lastTapRef.current
          if (last && now - last.at < DOUBLE_TAP_MS && distance(last.point, gesture.startPoint) < DOUBLE_TAP_PX) {
            lastTapRef.current = null
            apply(UNZOOMED)
            return
          }
          lastTapRef.current = { at: now, point: gesture.startPoint }
        }
      }

      window.addEventListener('touchmove', onMove, { passive: false })
      window.addEventListener('touchend', onEnd)
      window.addEventListener('touchcancel', onEnd)
      return true
    },
    [apply, onUserInteract],
  )

  return { zoom, zoomed: zoom.scale > 1, handleTouchStart }
}
