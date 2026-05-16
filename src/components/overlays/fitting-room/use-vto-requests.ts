import { useCallback, useRef, useState } from 'react'
import { requestVto as apiRequestVto, VtoCompositionItem } from '@/lib/api'
import { getLogger } from '@/lib/logger'
import { getStaticData } from '@/lib/store'
import { applyFrameBaseUrl } from '@/lib/util'

const logger = getLogger('overlays/fitting-room/use-vto-requests')

// Throttle non-priority requests behind the most-recent priority one so the
// pre-warm alternates don't crowd the user's actively-selected outfit. Mirrors
// vto-single's NON_PRIORITY_VTO_REQUEST_DELAY_MS.
const NON_PRIORITY_REQUEST_DELAY_MS = 500

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
  // Fire a /v1/vto-compositions POST if this outfit hasn't been requested yet.
  // priority=true marks this as the user-active outfit and resets the
  // non-priority throttle; priority=false fires pre-warm alternates that may
  // get delayed up to NON_PRIORITY_REQUEST_DELAY_MS.
  request: (items: VtoCompositionItem[], priority: boolean) => void
  // Return rewritten (base-URL-applied) frame URLs for the given outfit, or
  // null when not ready / not yet requested.
  framesForOutfit: (items: VtoCompositionItem[]) => string[] | null
  // Latest error from a /v1/vto-compositions POST. Resets after clearError().
  lastError: Error | null
  clearError: () => void
}

// useVtoRequests encapsulates the multi-garment VTO request flow against the
// synchronous /v1/vto-compositions endpoint: dedup POSTs by outfitKey and
// store the rendered frame paths per outfit. The endpoint returns frames
// directly in the response — there is no Firestore subscription.
export function useVtoRequests(): UseVtoRequestsHandle {
  // outfitKey → rendered frame paths
  const [framesByKey, setFramesByKey] = useState<Record<string, string[]>>({})
  // outfitKeys already requested (in-flight or completed) — dedup
  const requestedKeysRef = useRef<Set<string>>(new Set())
  const lastPriorityTimeRef = useRef<number | null>(null)
  const [lastError, setLastError] = useState<Error | null>(null)

  const clearError = useCallback(() => setLastError(null), [])

  const request = useCallback((items: VtoCompositionItem[], priority: boolean) => {
    if (items.length === 0) return
    const key = outfitKey(items)
    if (requestedKeysRef.current.has(key)) return

    const exec = () => {
      requestedKeysRef.current.add(key)
      logger.logDebug('Requesting VTO composition', { key, items, priority })
      apiRequestVto(items)
        .then((resp) => {
          logger.logDebug('VTO frames ready', { key, count: resp.frames.length })
          setFramesByKey((prev) => ({ ...prev, [key]: resp.frames }))
        })
        .catch((error) => {
          logger.logError('VTO request failed', { error, items, key })
          // Drop the key so a later re-selection retries the render.
          requestedKeysRef.current.delete(key)
          setLastError(error instanceof Error ? error : new Error(String(error)))
        })
    }

    if (priority) {
      lastPriorityTimeRef.current = Date.now()
      exec()
      return
    }
    const last = lastPriorityTimeRef.current
    let delay = 0
    if (last) {
      const now = Date.now()
      const minNext = last + NON_PRIORITY_REQUEST_DELAY_MS
      if (now < minNext) delay = minNext - now
    }
    if (delay > 0) {
      setTimeout(exec, delay)
    } else {
      exec()
    }
  }, [])

  const framesForOutfit = useCallback(
    (items: VtoCompositionItem[]): string[] | null => {
      if (items.length === 0) return null
      const key = outfitKey(items)
      const frames = framesByKey[key]
      if (!frames || frames.length === 0) return null
      const baseUrl = getStaticData().config.frames.baseUrl
      return frames.map((u) => applyFrameBaseUrl(u, baseUrl))
    },
    [framesByKey],
  )

  return { request, framesForOutfit, lastError, clearError }
}
