import type { RefObject } from 'react'
import { useEffect, useRef } from 'react'
import { TextT } from '@/components/text'
import { useIsDemoAvatar } from '@/lib/demo-avatar'
import { useCss } from '@/lib/theme'

// Mark an element that can be drawn over the try-on image (a bottom sheet,
// say) with this attribute; the watermark stays above it.
export const AVATAR_OCCLUDER_ATTRIBUTE = 'data-avatar-occluder'

// Inset of the watermark from the visible image's bottom-left corner.
const INSET_PX = 12

interface Rect {
  left: number
  top: number
  right: number
  bottom: number
}

function intersect(a: Rect, b: Rect): Rect {
  return {
    left: Math.max(a.left, b.left),
    top: Math.max(a.top, b.top),
    right: Math.min(a.right, b.right),
    bottom: Math.min(a.bottom, b.bottom),
  }
}

// visibleImageRect is the part of the image's picture the shopper can see, in
// viewport coordinates, or null while it can't be told (not loaded yet):
//
//   - the picture itself, not the <img> box: with object-fit: contain a frame
//     is letterboxed inside its box, and the bands around it are not image;
//   - before any pinch-zoom transform, so the watermark doesn't zoom with it;
//   - cut to every ancestor that clips (the viewer box, a scroll area);
//   - stopping above any element marked AVATAR_OCCLUDER_ATTRIBUTE that is
//     drawn over it.
export function visibleImageRect(img: HTMLImageElement): Rect | null {
  if (!img.naturalWidth || !img.naturalHeight || !img.clientWidth || !img.clientHeight) {
    return null
  }
  // The box without the transform: the offset parent's position plus the
  // image's offset within it, at its layout size.
  const parent = img.offsetParent
  const parentRect = parent ? parent.getBoundingClientRect() : { left: 0, top: 0 }
  const boxLeft = parentRect.left + img.offsetLeft + img.clientLeft
  const boxTop = parentRect.top + img.offsetTop + img.clientTop
  let width = img.clientWidth
  let height = img.clientHeight
  let left = boxLeft
  let top = boxTop

  const fit = getComputedStyle(img).objectFit
  if (fit === 'contain' || fit === 'scale-down') {
    const scale = Math.min(img.clientWidth / img.naturalWidth, img.clientHeight / img.naturalHeight)
    const s = fit === 'scale-down' ? Math.min(scale, 1) : scale
    width = img.naturalWidth * s
    height = img.naturalHeight * s
    // object-position defaults to centred, which is all this SDK uses.
    left = boxLeft + (img.clientWidth - width) / 2
    top = boxTop + (img.clientHeight - height) / 2
  }
  let rect: Rect = { left, top, right: left + width, bottom: top + height }

  // Stop below <body>. The overlays are mounted on it, fixed and full-screen,
  // and the store's <body> does not clip them: its overflow belongs to the
  // viewport. Counting it is wrong, not just redundant: a store locks page
  // scroll while an overlay is open with overflow: hidden on a <body> whose
  // box can be far shorter than the screen.
  for (let el = img.parentElement; el && el !== document.body; el = el.parentElement) {
    const style = getComputedStyle(el)
    if (style.overflowX !== 'visible' || style.overflowY !== 'visible') {
      const clip = el.getBoundingClientRect()
      rect = intersect(rect, {
        left: clip.left + el.clientLeft,
        top: clip.top + el.clientTop,
        right: clip.left + el.clientLeft + el.clientWidth,
        bottom: clip.top + el.clientTop + el.clientHeight,
      })
    }
  }

  const root = img.getRootNode() as Document | ShadowRoot
  root.querySelectorAll(`[${AVATAR_OCCLUDER_ATTRIBUTE}]`).forEach((occluder) => {
    const o = occluder.getBoundingClientRect()
    const overlapsHorizontally = o.left < rect.right && o.right > rect.left
    if (o.width > 0 && o.height > 0 && overlapsHorizontally && o.top < rect.bottom && o.bottom > rect.top) {
      rect = { ...rect, bottom: Math.min(rect.bottom, o.top) }
    }
  })

  return rect.right > rect.left && rect.bottom > rect.top ? rect : null
}

// DemoWatermark marks a try-on image as rendered on the demo avatar, not the
// shopper's own body, so nobody mistakes the fit for theirs. "DEMO" / "AVATAR",
// one word per line, in the bottom-left corner of the visible picture
// (visibleImageRect), so it is always on the image and never covers more of
// the avatar than its feet.
//
// Render it inside the positioned element that holds the image and pass the
// image's ref. The position is re-read every animation frame, as the help
// popups' anchors are: frames load, the viewer resizes, sheets animate and
// the zoom view scrolls without telling anyone. Hidden until the image has a
// size, and when the visible picture is too small to hold it. It ignores
// pointer events (drag-to-rotate and pinch still reach the image) and renders
// nothing for a shopper with their own avatar.
export function DemoWatermark({ imageRef }: { imageRef: RefObject<HTMLImageElement | null> }) {
  const isDemo = useIsDemoAvatar()
  const markRef = useRef<HTMLDivElement>(null)
  const css = useCss((_theme) => ({
    container: {
      position: 'absolute',
      left: 0,
      top: 0,
      pointerEvents: 'none',
      visibility: 'hidden',
    },
    text: {
      display: 'block',
      // 18px until WEB-49 asked for it a bit bigger.
      fontSize: '22px',
      fontWeight: '700',
      lineHeight: 1.1,
      letterSpacing: '2.5px',
      textTransform: 'uppercase',
      // The copy carries its own line break: one word per line.
      whiteSpace: 'pre-line',
      // The corner is studio background (light grey), not garment, so dark
      // text reads best; the light halo keeps it legible on a darker frame.
      color: 'rgba(0, 0, 0, 0.55)',
      textShadow: '0 0 3px rgba(255, 255, 255, 0.8)',
      userSelect: 'none',
    },
  }))

  useEffect(() => {
    if (!isDemo) {
      return
    }
    let frame = 0
    const place = () => {
      const mark = markRef.current
      const img = imageRef.current
      if (mark && img) {
        const visible = visibleImageRect(img)
        const parent = mark.offsetParent
        const fits =
          visible &&
          visible.right - visible.left >= mark.offsetWidth + 2 * INSET_PX &&
          visible.bottom - visible.top >= mark.offsetHeight + 2 * INSET_PX
        if (visible && parent && fits) {
          const p = parent.getBoundingClientRect()
          const left = visible.left - p.left - parent.clientLeft + INSET_PX
          const top = visible.bottom - p.top - parent.clientTop - INSET_PX - mark.offsetHeight
          mark.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`
          mark.style.visibility = 'visible'
        } else {
          mark.style.visibility = 'hidden'
        }
      }
      frame = requestAnimationFrame(place)
    }
    place()
    return () => cancelAnimationFrame(frame)
  }, [isDemo, imageRef])

  if (!isDemo) {
    return null
  }
  return (
    <div ref={markRef} css={css.container} data-testid="demo-watermark">
      <TextT variant="base" css={css.text} t="mini_me.demo_watermark" />
    </div>
  )
}
