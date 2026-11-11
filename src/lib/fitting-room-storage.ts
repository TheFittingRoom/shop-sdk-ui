import { getAuthManager } from '@/lib/firebase'
import { getLogger } from '@/lib/logger'
import { getStaticData, useMainStore } from '@/lib/store'

// A fitting-room entry holds only what the shopper chose (WEB-105): `size`
// is set when they click a size (in the fitting room or quick view) and is
// otherwise null, `color` is their colour pick. The size, colour and
// colorway-size asset actually used are derived from these plus the current
// size recommendation (FittingRoomSelection, fitting-room-data.ts), so
// nothing stored here can go stale when the recommendation changes.
//
// Entries saved before WEB-105 also carry a `colorwaySizeAssetId` and may
// hold a size the shopper never clicked (an auto-picked recommendation).
// The id is dropped on read (normalizeItems); the size is kept and treated
// as chosen — Ky's call, so existing selections aren't reset. Revisit if
// wrong-size reports keep coming from fitting rooms saved before then.
export interface FittingRoomItem {
  externalId: string
  handle: string | null
  size: string | null
  color: string | null
  addedAt: number
}

export const STORAGE_KEY = 'tfr:fitting-room:v1'

// The bucket key used when no shopper is logged in. Firebase UIDs are
// non-empty base64-ish strings, so a distinctive sentinel avoids any
// theoretical collision.
const ANONYMOUS_BUCKET_KEY = '__anonymous__'

const logger = getLogger('fitting-room-storage')

// Storage shape:
//   { [brandId]: { [userId | ANONYMOUS_BUCKET_KEY]: FittingRoomItem[] } }
//
// Original v1 shape was `{ [brandId]: FittingRoomItem[] }` (unscoped
// per-shopper). Migration on read: if the value at a brand key is an
// array, it's read as the anonymous bucket. The normalized v2 shape
// gets written back on the next mutation. STORAGE_KEY intentionally
// unchanged (no `:v2` bump) — we're pre-launch, and in-place migration
// preserves current testers' fitting rooms.
type UserBuckets = Record<string, FittingRoomItem[]>
type StoredShape = Record<string, UserBuckets | FittingRoomItem[]>

// Module-level state, kept in sync with the currently-authenticated
// Firebase user by the auth listener registered in _init. Fitting-room
// reads/writes route through this key so the same public
// readFittingRoom/writeFittingRoom API keeps working for callers
// (store.ts mutations) without them having to know about user scoping.
let currentBucketKey: string = ANONYMOUS_BUCKET_KEY

function readAll(): StoredShape {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return {}
    }
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {}
    }
    return parsed as StoredShape
  } catch (error) {
    logger.logWarn('Failed to read fitting room from localStorage', { error })
    return {}
  }
}

function writeAll(all: StoredShape): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
  } catch (error) {
    logger.logWarn('Failed to write fitting room to localStorage', { error })
  }
}

// Return the (brand → userBuckets) map for the given brand, normalizing
// a v1 array entry into `{ [ANONYMOUS_BUCKET_KEY]: <array> }`.
function readBrandBuckets(all: StoredShape, brandId: number): UserBuckets {
  const raw = all[String(brandId)]
  if (Array.isArray(raw)) {
    return { [ANONYMOUS_BUCKET_KEY]: raw }
  }
  if (raw && typeof raw === 'object') {
    return { ...raw }
  }
  return {}
}

// normalizeItems keeps only the fields FittingRoomItem has, dropping what
// older entries carried (colorwaySizeAssetId before WEB-105), so the next
// write stores the current shape.
function normalizeItems(items: unknown): FittingRoomItem[] {
  if (!Array.isArray(items)) {
    return []
  }
  return items.map((item: FittingRoomItem) => ({
    externalId: item.externalId,
    handle: item.handle ?? null,
    size: item.size ?? null,
    color: item.color ?? null,
    addedAt: item.addedAt,
  }))
}

export function readFittingRoom(brandId: number): FittingRoomItem[] {
  const buckets = readBrandBuckets(readAll(), brandId)
  return normalizeItems(buckets[currentBucketKey])
}

export function writeFittingRoom(brandId: number, items: FittingRoomItem[]): void {
  const all = readAll()
  const buckets = readBrandBuckets(all, brandId)
  buckets[currentBucketKey] = items
  all[String(brandId)] = buckets
  writeAll(all)
}

// Called by the auth listener when a shopper logs in. Merges the
// anonymous bucket into the user's bucket (user's picks win on
// externalId collision — a size picked while signed out was picked
// against another avatar's recommendation), clears anonymous, and returns the resulting
// user-bucket contents. Idempotent: if anonymous is already empty,
// nothing changes.
function mergeAnonymousIntoUser(brandId: number, userId: string): FittingRoomItem[] {
  const all = readAll()
  const buckets = readBrandBuckets(all, brandId)
  const anon = normalizeItems(buckets[ANONYMOUS_BUCKET_KEY])
  const user = normalizeItems(buckets[userId])
  const userExternalIds = new Set(user.map((item) => item.externalId))
  const additions = anon.filter((item) => !userExternalIds.has(item.externalId))
  const merged = [...user, ...additions]
  buckets[userId] = merged
  buckets[ANONYMOUS_BUCKET_KEY] = []
  all[String(brandId)] = buckets
  writeAll(all)
  return merged
}

export function _init(): void {
  const { brandId } = getStaticData()

  // Cross-tab freshness: localStorage fires `storage` on *other* tabs
  // (not the writing tab) whenever a key changes. When another tab
  // mutates the fitting room, re-read from localStorage so this tab's
  // in-memory model — and any UI subscribing to it — stays in sync.
  // The writing tab doesn't get this event, which is correct (would
  // otherwise loop). We re-read via currentBucketKey so each tab only
  // reflects changes to its own logged-in-shopper bucket; a login on
  // Tab A that harvests anonymous is correctly observed as an
  // anonymous-clear on Tab B (which is on the anonymous bucket at
  // that moment).
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', (e) => {
      if (e.key !== STORAGE_KEY) {
        return
      }
      useMainStore.setState({ fittingRoom: readFittingRoom(brandId) })
    })
  }

  // Subscribe to auth state changes. addAuthStateChangeListener fires
  // its callback immediately with the current auth state on
  // registration, which serves as the initial fitting-room read at
  // boot — no separate synchronous load needed.
  //
  // Transitions:
  //  - null → user      : merge anonymous into user's bucket, clear
  //                       anonymous, use user's bucket.
  //  - userA → userB    : (rare — no logout in between) merge anonymous
  //                       into userB, use userB's bucket. userA's data
  //                       stays put in their own bucket.
  //  - user → null      : switch back to anonymous. User's items stay
  //                       persisted under their bucket for next login.
  //  - initial null     : anonymous bucket.
  //  - initial user     : merge (in case v1 array was migrated) and
  //                       use user's bucket.
  const authManager = getAuthManager()
  authManager.addAuthStateChangeListener((authUser) => {
    if (authUser) {
      currentBucketKey = authUser.uid
      const items = mergeAnonymousIntoUser(brandId, authUser.uid)
      useMainStore.setState({ fittingRoom: items })
    } else {
      currentBucketKey = ANONYMOUS_BUCKET_KEY
      useMainStore.setState({ fittingRoom: readFittingRoom(brandId) })
    }
  })
}

// The add path shared by toggleFittingRoomItem and ensureFittingRoomItem.
//
// We deliberately do NOT capture the PDP's currently-selected size. Size
// belongs to the TFR size-recommendation flow: until the shopper clicks a
// size in one of our overlays the item follows the current recommendation
// (WEB-105). Storing the PDP size here would override that — typically with
// something the shopper picked before the size recommendation existed.
async function addFittingRoomItem(productId: string, handle: string | null, isPdp: boolean): Promise<void> {
  const state = useMainStore.getState()
  logger.logDebug('{{ts}} - Adding to fitting room', { productId, handle, isPdp })

  let color: string | null = null
  let resolvedHandle: string | null = handle

  if (isPdp) {
    const { currentProduct } = getStaticData()
    if (currentProduct) {
      if (!resolvedHandle) {
        resolvedHandle = currentProduct.handle
      }
      try {
        const selection = await currentProduct.getSelectedOptions()
        color = selection.color
      } catch (error) {
        logger.logWarn('Failed to read selected options from currentProduct', { error })
      }
    }
  }

  state.addToFittingRoom({
    externalId: productId,
    handle: resolvedHandle,
    size: null,
    color,
    addedAt: Date.now(),
  })
  state.setLastAddEvent(productId)
}

// Re-read currentProduct's selected color and, if the product is already in
// the fitting-room storage, write the new color (and re-resolved CSA) to
// its entry. Intended use: the host theme calls this whenever the PDP's
// variant selector changes, so the shopper's latest color pick is reflected
// the next time they open any TFR overlay.
//
// PDP size is deliberately ignored — size belongs to the TFR size-rec flow,
// not the PDP. Any size the shopper picked inside a TFR overlay is
// preserved; only the colour is written.
//
// No-op when there's no currentProduct (e.g. we're on a collection page),
// when the product isn't in the fitting room, or when the new color matches
// what's already stored. Safe to call as often as needed.
export async function syncCurrentProductSelection(): Promise<void> {
  const { currentProduct } = getStaticData()
  if (!currentProduct) {
    return
  }
  const state = useMainStore.getState()
  const existing = state.fittingRoom.find((item) => item.externalId === currentProduct.externalId)
  if (!existing) {
    return
  }

  let color: string | null = null
  try {
    const selection = await currentProduct.getSelectedOptions()
    color = selection.color
  } catch (error) {
    logger.logWarn('syncCurrentProductSelection: failed to read selected options', { error })
    return
  }

  if (color === existing.color) {
    return
  }

  state.updateFittingRoomItem(currentProduct.externalId, { color })
  logger.logDebug('{{ts}} - Synced PDP color into fitting-room', { externalId: currentProduct.externalId, color })
}

export async function toggleFittingRoomItem(productId: string, handle: string | null, isPdp: boolean): Promise<void> {
  const state = useMainStore.getState()
  const isInFittingRoom = state.fittingRoom.some((item) => item.externalId === productId)
  if (isInFittingRoom) {
    logger.logDebug('{{ts}} - Removing from fitting room', { productId })
    state.removeFromFittingRoom(productId)
    return
  }
  await addFittingRoomItem(productId, handle, isPdp)
}

// Add the product to the fitting room if it isn't already there — never
// removes. Used when opening the fitting-room overlay from the PDP "Try It
// On" CTA, where the current product must be present so it can be preselected.
export async function ensureFittingRoomItem(productId: string, handle: string | null, isPdp: boolean): Promise<void> {
  const state = useMainStore.getState()
  if (state.fittingRoom.some((item) => item.externalId === productId)) {
    return
  }
  await addFittingRoomItem(productId, handle, isPdp)
}
