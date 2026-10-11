import { useCallback, useEffect, useRef, useState } from 'react'
import type { VtoCompositionItem } from '@/lib/api'
import { requestVto as apiRequestVto } from '@/lib/api'
import { getLogger } from '@/lib/logger'
import { getStaticData } from '@/lib/store'
import { applyFrameBaseUrl } from '@/lib/util'

const logger = getLogger('use-vto-requests')

// outfitKey is the dedup / lookup key for a composition. Sorted to normalize
// item ordering so two outfits with identical (csa, untucked) tuples in
// different positions hit the same cache entry.
export function outfitKey(items: VtoCompositionItem[]): string {
  return items
    .map((i) => `${i.colorway_size_asset_id}:${i.untucked ? 1 : 0}`)
    .sort()
    .join('|')
}

export interface UseVtoRequestsHandle {
  // Ask for an outfit's frames. priority=true marks it as the selected outfit:
  // it is posted at once (or joins the request already in flight for it) and
  // alternates queued for the previous selection are dropped. priority=false
  // queues a speculative prefetch. Prefetches start only once the selected
  // outfit's request has settled (frames, cache hit or failure) and
  // config.api.vtoPrefetchDelayMs has passed, and run one at a time. An empty
  // priority request means nothing is selected.
  request: (items: VtoCompositionItem[], priority: boolean) => void
  // Return rewritten (base-URL-applied) frame URLs for the given outfit, or
  // null when not ready / not yet requested.
  framesForOutfit: (items: VtoCompositionItem[]) => string[] | null
  // Latest error from the selected outfit's /v1/vto-compositions POST.
  // Resets after clearError().
  lastError: Error | null
  clearError: () => void
}

interface QueuedOutfit {
  key: string
  items: VtoCompositionItem[]
}

// useVtoRequests encapsulates the VTO request flow against the synchronous
// /v1/vto-compositions endpoint: dedup POSTs by outfitKey and store the
// rendered frame paths per outfit. The endpoint returns frames directly in
// the response — there is no Firestore subscription. Shared by both VTO
// overlays: the fitting room (multi-garment outfits + prefetch alternates)
// and quick-view (a one-item outfit per size/color).
export function useVtoRequests(): UseVtoRequestsHandle {
  // outfitKey → rendered frame paths
  const [framesByKey, setFramesByKey] = useState<Record<string, string[]>>({})
  // outfitKeys already requested (in-flight or completed) — dedup
  const requestedKeysRef = useRef<Set<string>>(new Set())
  // outfitKeys whose last POST failed. Not retried as prefetches; selecting
  // the outfit again is what retries it.
  const failedKeysRef = useRef<Set<string>>(new Set())
  // outfitKey → this hook's request in flight, settling once it has resolved
  // or failed. Lets a selection join a prefetch that is already running.
  const inFlightRef = useRef<Map<string, Promise<void>>>(new Map())
  const selectedKeyRef = useRef<string | null>(null)
  // Bumped on every selection change, so a settle callback can tell whether
  // the selection it was registered for is still the current one (the same
  // outfit can be deselected and reselected while its request is in flight).
  const selectionRef = useRef(0)
  const queueRef = useRef<QueuedOutfit[]>([])
  // True once the selected outfit has settled and the prefetch delay passed.
  const prefetchOpenRef = useRef(false)
  const prefetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Only one queue runner exists at a time, which is what caps speculative
  // requests at one in flight.
  const drainingRef = useRef(false)
  const [lastError, setLastError] = useState<Error | null>(null)

  const clearError = useCallback(() => setLastError(null), [])

  const post = useCallback((key: string, items: VtoCompositionItem[]): Promise<void> => {
    const inFlight = inFlightRef.current.get(key)
    if (inFlight) {
      return inFlight
    }
    if (requestedKeysRef.current.has(key)) {
      return Promise.resolve()
    }
    requestedKeysRef.current.add(key)
    failedKeysRef.current.delete(key)
    logger.logDebug('Requesting VTO composition', { key, items, selected: key === selectedKeyRef.current })
    const settled = apiRequestVto(items)
      .then((resp) => {
        logger.logDebug('VTO frames ready', { key, count: resp.frames.length })
        setFramesByKey((prev) => ({ ...prev, [key]: resp.frames }))
      })
      .catch((error) => {
        logger.logError('VTO request failed', { error, items, key })
        requestedKeysRef.current.delete(key)
        failedKeysRef.current.add(key)
        // A failed prefetch or a superseded selection isn't something the
        // shopper is looking at.
        if (key === selectedKeyRef.current) {
          setLastError(error instanceof Error ? error : new Error(String(error)))
        }
      })
      .finally(() => {
        inFlightRef.current.delete(key)
      })
    inFlightRef.current.set(key, settled)
    return settled
  }, [])

  const drainQueue = useCallback(async () => {
    if (drainingRef.current) {
      return
    }
    drainingRef.current = true
    try {
      while (prefetchOpenRef.current) {
        const next = queueRef.current.shift()
        if (!next) {
          break
        }
        if (requestedKeysRef.current.has(next.key) || failedKeysRef.current.has(next.key)) {
          continue
        }
        await post(next.key, next.items)
      }
    } finally {
      drainingRef.current = false
    }
  }, [post])

  // Point the scheduler at a new selection (null for none, and on unmount).
  // Alternates queued for the old one are dropped. A prefetch already in
  // flight is left to finish: its render is already running on the backend.
  const select = useCallback((key: string | null) => {
    selectedKeyRef.current = key
    selectionRef.current += 1
    queueRef.current = []
    prefetchOpenRef.current = false
    if (prefetchTimerRef.current !== null) {
      clearTimeout(prefetchTimerRef.current)
      prefetchTimerRef.current = null
    }
  }, [])

  const request = useCallback(
    (items: VtoCompositionItem[], priority: boolean) => {
      if (items.length === 0) {
        if (priority) {
          select(null)
        }
        return
      }
      const key = outfitKey(items)

      if (priority) {
        // Callers re-run their request effects for reasons other than a new
        // selection. Treating that as a reselection would re-post a failed
        // outfit on its own.
        if (key === selectedKeyRef.current) {
          return
        }
        select(key)
        const selection = selectionRef.current
        void post(key, items).then(() => {
          if (selectionRef.current !== selection) {
            return
          }
          prefetchTimerRef.current = setTimeout(() => {
            prefetchTimerRef.current = null
            prefetchOpenRef.current = true
            void drainQueue()
          }, getStaticData().config.api.vtoPrefetchDelayMs)
        })
        return
      }

      if (
        requestedKeysRef.current.has(key) ||
        failedKeysRef.current.has(key) ||
        queueRef.current.some((queued) => queued.key === key)
      ) {
        return
      }
      queueRef.current.push({ key, items })
      void drainQueue()
    },
    [post, drainQueue, select],
  )

  // Drop the queue and the selection when the overlay unmounts so nothing
  // further is posted for it.
  useEffect(() => () => select(null), [select])

  const framesForOutfit = useCallback(
    (items: VtoCompositionItem[]): string[] | null => {
      if (items.length === 0) {
        return null
      }
      const key = outfitKey(items)
      const frames = framesByKey[key]
      if (!frames || frames.length === 0) {
        return null
      }
      const baseUrl = getStaticData().config.frames.baseUrl
      return frames.map((u) => applyFrameBaseUrl(u, baseUrl))
    },
    [framesByKey],
  )

  return { request, framesForOutfit, lastError, clearError }
}
