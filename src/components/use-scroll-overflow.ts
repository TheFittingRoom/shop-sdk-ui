import type { DependencyList, RefObject } from 'react'
import { useCallback, useLayoutEffect, useState } from 'react'

export interface ScrollOverflow {
  // More content past the start (left / top) edge.
  start: boolean
  // More content past the end (right / bottom) edge.
  end: boolean
  // Width (y axis) or height (x axis) the element's scrollbar takes up; 0 for
  // overlay scrollbars. Lets an edge affordance stop short of it.
  scrollbarSize: number
  // Re-measure. Wire to the element's onScroll.
  update: () => void
}

const NONE = { start: false, end: false, scrollbarSize: 0 }

// useScrollOverflow reports which edges of a scrolling element still have
// content past them, for "there's more this way" affordances. It re-measures
// on mount, whenever `deps` change, and when the element or any of its direct
// children resize — content can grow without the element itself changing
// size (product data arriving, an image in a description loading).
export function useScrollOverflow(
  ref: RefObject<HTMLElement | null>,
  axis: 'x' | 'y',
  deps: DependencyList,
): ScrollOverflow {
  const [state, setState] = useState(NONE)

  // Cheap — most scroll events leave every value unchanged, and returning the
  // previous object lets React bail on the re-render.
  const update = useCallback(() => {
    const el = ref.current
    const next = !el
      ? NONE
      : axis === 'x'
        ? {
            start: el.scrollLeft > 1,
            end: el.scrollLeft + el.clientWidth < el.scrollWidth - 1,
            scrollbarSize: el.offsetHeight - el.clientHeight,
          }
        : {
            start: el.scrollTop > 1,
            end: el.scrollTop + el.clientHeight < el.scrollHeight - 1,
            scrollbarSize: el.offsetWidth - el.clientWidth,
          }
    setState((prev) =>
      prev.start === next.start && prev.end === next.end && prev.scrollbarSize === next.scrollbarSize ? prev : next,
    )
  }, [ref, axis])

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) {
      update()
      return
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    for (const child of Array.from(el.children)) {
      observer.observe(child)
    }
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [update, ...deps])

  return { ...state, update }
}
