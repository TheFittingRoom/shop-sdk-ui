import { useCallback, useEffect, useRef, useState } from 'react'
import { requestVto as apiRequestVto, VtoCompositionItem } from '@/lib/api'
import { getAuthManager, getFirestoreManager } from '@/lib/firebase'
import { getLogger } from '@/lib/logger'
import { getStaticData } from '@/lib/store'
import { applyFrameBaseUrl } from '@/lib/util'

const logger = getLogger('overlays/fitting-room/use-vto-subscriptions')

// Throttle non-priority requests behind the most-recent priority one so the
// pre-warm alternates don't crowd the user's actively-selected outfit. Mirrors
// vto-single's NON_PRIORITY_VTO_REQUEST_DELAY_MS.
const NON_PRIORITY_REQUEST_DELAY_MS = 500

export type VtoFramesDoc = {
  frames?: string[]
  error?: string
  status?: 'pending' | 'ready' | 'failed' | string
}

// outfitKey is the dedup / lookup key for a composition. Sorted to normalize
// item ordering so two outfits with identical (csa, untucked) tuples in
// different positions hit the same cache entry.
export function outfitKey(items: VtoCompositionItem[]): string {
  return items
    .map((i) => `${i.colorway_size_asset_id}:${i.untucked ? 1 : 0}`)
    .sort()
    .join('|')
}

export interface UseVtoSubscriptionsHandle {
  // Fire a /v1/vto-compositions POST if this outfit hasn't been requested yet.
  // priority=true marks this as the user-active outfit and resets the
  // non-priority throttle; priority=false fires pre-warm alternates that may
  // get delayed up to NON_PRIORITY_REQUEST_DELAY_MS.
  request: (items: VtoCompositionItem[], priority: boolean) => void
  // Return rewritten (base-URL-applied) frame URLs for the given outfit, or
  // null when not ready / not yet requested.
  framesForOutfit: (items: VtoCompositionItem[]) => string[] | null
  // Latest error from a /v1/vto-compositions POST or Firestore snapshot.
  // Resets to null after `clearError()`.
  lastError: Error | null
  clearError: () => void
}

// useVtoSubscriptions encapsulates the multi-garment VTO request + Firestore
// subscription pattern: dedup POSTs by outfitKey, subscribe per returned
// token to users/{uid}/vto_compositions/{token}, expose the latest frames per
// outfit. All subscriptions are torn down on unmount.
export function useVtoSubscriptions(): UseVtoSubscriptionsHandle {
  // outfitKey → token (or "" while POST is in-flight)
  const compositionTokensRef = useRef<Map<string, string>>(new Map())
  // token → unsubscribe handle
  const subscriptionsRef = useRef<Map<string, () => void>>(new Map())
  // token → latest snapshot
  const [vtoDocsByToken, setVtoDocsByToken] = useState<Record<string, VtoFramesDoc>>({})
  const lastPriorityTimeRef = useRef<number | null>(null)
  const [lastError, setLastError] = useState<Error | null>(null)

  const clearError = useCallback(() => setLastError(null), [])

  const subscribe = useCallback((token: string, key: string) => {
    if (subscriptionsRef.current.has(token)) return
    const uid = getAuthManager().getAuthUser()?.uid
    if (!uid) {
      logger.logWarn('subscribe skipped: no uid', { token, key })
      return
    }
    const unsub = getFirestoreManager().listenToSubDoc<VtoFramesDoc>(
      'users',
      uid,
      'vto_compositions',
      token,
      (data) => {
        if (data?.frames?.length) {
          logger.logDebug('VTO frames ready', { key, token, count: data.frames.length })
        }
        if (data?.error) {
          setLastError(new Error(data.error))
        }
        setVtoDocsByToken((prev) => ({ ...prev, [token]: data ?? {} }))
      },
    )
    subscriptionsRef.current.set(token, unsub)
  }, [])

  const request = useCallback(
    (items: VtoCompositionItem[], priority: boolean) => {
      if (items.length === 0) return
      const key = outfitKey(items)
      if (compositionTokensRef.current.has(key)) return

      const exec = () => {
        compositionTokensRef.current.set(key, '')
        logger.logDebug('Requesting VTO composition', { key, items, priority })
        apiRequestVto(items)
          .then((resp) => {
            compositionTokensRef.current.set(key, resp.token)
            subscribe(resp.token, key)
          })
          .catch((error) => {
            logger.logError('VTO request failed', { error, items, key })
            compositionTokensRef.current.delete(key)
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
    },
    [subscribe],
  )

  // Tear down all subscriptions on unmount.
  useEffect(() => {
    return () => {
      subscriptionsRef.current.forEach((unsub) => {
        try {
          unsub()
        } catch (e) {
          logger.logError('Error unsubscribing', { error: e })
        }
      })
      subscriptionsRef.current.clear()
    }
  }, [])

  const framesForOutfit = useCallback(
    (items: VtoCompositionItem[]): string[] | null => {
      if (items.length === 0) return null
      const key = outfitKey(items)
      const token = compositionTokensRef.current.get(key)
      if (!token) return null
      const doc = vtoDocsByToken[token]
      if (!doc?.frames?.length) return null
      const baseUrl = getStaticData().config.frames.baseUrl
      return doc.frames.map((u) => applyFrameBaseUrl(u, baseUrl))
    },
    [vtoDocsByToken],
  )

  return { request, framesForOutfit, lastError, clearError }
}
