import type { StyleCategory, StyleCategoryGroup } from '@/api/gen/responses'
import type { ResolvedFittingRoom, ResolvedFittingRoomItem } from '@/lib/fitting-room-data'
import { isItemTuckable } from '@/lib/fitting-room-data'
import { resolveContainerExpansion } from '@/lib/product'

export type Availability = 'available' | 'selected' | 'disabled'

// MAX_OUTFIT_ITEMS caps GARMENTS (not products) in an outfit — matches the
// backend + sim-vis wire cap of 4 items on /v1/vto-compositions. A container
// product's garment count is its children.length (via item.effective.length),
// so a 3-piece Set consumes 3 slots and adding a fifth garment (of any shape)
// hits the cap.
export const MAX_OUTFIT_ITEMS = 4

// Garment count per resolved item: containers contribute one per child (via
// EffectiveCategory list); single-garment items contribute 1. Returns 0
// when the style-category index hasn't populated yet — treating an
// unresolved item as weightless is safer than blocking the add, and the
// isReady flag on the caller handles the display-time skip.
function getGarmentCount(item: ResolvedFittingRoomItem): number {
  if (item.effective.length > 0) {
    return item.effective.length
  }
  return item.styleCategory ? 1 : 0
}

export interface OutfitItem {
  externalId: string
  colorwaySizeAssetId: number
  untucked?: true
  /**
   * For container (Suits & Sets) products: pre-resolved child CSA ids the SDK
   * will emit as separate items[] entries when the wire request is built.
   * Undefined for single-garment products. Populated at OutfitItem
   * construction time from the resolved loadedProduct's container data.
   */
  childCsaIds?: number[]
}

export interface Outfit {
  items: OutfitItem[]
  alternates: OutfitItem[][]
}

// `StyleCategory.includes` / `excludes` are gen'd as `any[]` (Go []enums.StyleCategory).
// Normalize to plain strings so the rule check is straightforward.
function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }
  const out: string[] = []
  for (const v of value) {
    if (typeof v === 'string') {
      out.push(v)
    } else if (v != null) {
      out.push(String(v))
    }
  }
  return out
}

function catName(c: StyleCategory): string {
  return String(c.name)
}

// itemsCompatible returns true if `a` and `b` can coexist in the same outfit,
// considering each item's EFFECTIVE categories (children for containers, self
// for single-garment). Fails if any A-child × B-child pair is incompatible
// under pairCompatible.
export function itemsCompatible(a: ResolvedFittingRoomItem, b: ResolvedFittingRoomItem): boolean {
  if (a.effective.length === 0 || b.effective.length === 0) {
    return true
  }
  for (const ae of a.effective) {
    for (const be of b.effective) {
      if (!pairCompatible(ae.category, be.category, ae.group)) {
        return false
      }
    }
  }
  return true
}

// pairCompatible returns true if `a` and `b` can coexist in the same outfit.
// `group` is the group of `a` (which equals `b`'s group when categories are
// in the same group). When the categories are in different groups, only the
// `excludes` lists matter.
function pairCompatible(a: StyleCategory, b: StyleCategory, group: StyleCategoryGroup | null): boolean {
  const aName = catName(a)
  const bName = catName(b)
  const aIncl = asStringList(a.includes)
  const aExcl = asStringList(a.excludes)
  const bIncl = asStringList(b.includes)
  const bExcl = asStringList(b.excludes)

  if (aExcl.includes(bName) || bExcl.includes(aName)) {
    return false
  }

  if (a.group !== b.group) {
    return true
  }

  // Same group: governed by same_group_default, optionally overridden by includes.
  const sameGroupDefault = group?.same_group_default ?? 'exclusive'
  if (sameGroupDefault === 'compatible') {
    return true
  }
  // Exclusive group: same category never coexists; different categories only
  // coexist when either side names the other in `includes`.
  if (aName === bName) {
    return false
  }
  return aIncl.includes(bName) || bIncl.includes(aName)
}

// Same-category items can never coexist in an outfit (one pair of pants,
// one long-sleeve top, etc), but the UI handles them as a *silent swap* on
// select: tapping a new same-category card adds it and evicts the previous
// selection in the same category. This helper returns the externalIds that
// would be evicted, so both the availability check (which must treat the
// would-evict items as "not occupying a slot") and the select handler
// (which performs the eviction) work from the same rule.
export function getSameCategoryConflicts(
  item: ResolvedFittingRoomItem,
  selectedExternalIds: ReadonlySet<string>,
  resolved: ResolvedFittingRoom,
): string[] {
  if (!item.styleCategory) {
    return []
  }
  const itemName = catName(item.styleCategory)
  const out: string[] = []
  for (const sel of resolved.items) {
    if (sel.externalId === item.externalId) {
      continue
    }
    if (!selectedExternalIds.has(sel.externalId)) {
      continue
    }
    if (!sel.styleCategory) {
      continue
    }
    if (catName(sel.styleCategory) === itemName) {
      out.push(sel.externalId)
    }
  }
  return out
}

export function computeAvailability(
  item: ResolvedFittingRoomItem,
  selectedExternalIds: ReadonlySet<string>,
  resolved: ResolvedFittingRoom,
): Availability {
  if (selectedExternalIds.has(item.externalId)) {
    return 'selected'
  }
  if (!item.styleCategory) {
    return 'disabled'
  }

  // Same-category items would be silently evicted on add. Treat them as
  // freed slots when computing effective outfit size and when checking
  // pair-compatibility — they're about to leave the outfit anyway.
  //
  // Same-category conflict keys on the PARENT category (so Set-vs-Set
  // silent-swaps, and Pants-vs-Pants silent-swaps). Set-vs-standalone-Pants
  // does not silent-swap even when the Set includes pants — the pairwise
  // check below catches that as an incompatible add.
  const sameCategoryEvictions = new Set(getSameCategoryConflicts(item, selectedExternalIds, resolved))

  // Garment-count cap: sum children per selected item, plus the new item's
  // own garment count. Containers count as N.
  let effectiveGarments = getGarmentCount(item)
  for (const sel of resolved.items) {
    if (!selectedExternalIds.has(sel.externalId)) {
      continue
    }
    if (sameCategoryEvictions.has(sel.externalId)) {
      continue
    }
    effectiveGarments += getGarmentCount(sel)
  }
  if (effectiveGarments > MAX_OUTFIT_ITEMS) {
    return 'disabled'
  }

  for (const sel of resolved.items) {
    if (!selectedExternalIds.has(sel.externalId)) {
      continue
    }
    if (sameCategoryEvictions.has(sel.externalId)) {
      continue
    }
    if (!itemsCompatible(sel, item)) {
      return 'disabled'
    }
  }
  return 'available'
}

interface OutfitBuilderEntry {
  outfitItem: OutfitItem
  layerOrder: number
  // Garment count this OutfitItem contributes to the wire request — 1 for
  // single-garment items, N for containers (childCsaIds.length). Kept
  // alongside layerOrder so the final MAX_OUTFIT_ITEMS trim can enforce
  // the cap on the wire-item count that will actually go to sim-vis.
  garmentCount: number
}

function makeOutfitItem(r: ResolvedFittingRoomItem, forceUntuck: boolean): OutfitBuilderEntry | null {
  if (!r.styleCategory) {
    return null
  }
  if (r.storage.colorwaySizeAssetId == null) {
    return null
  }
  // Tuckable is a per-CHILD trait; the container's own category
  // (suits_and_sets) is a wrapper and never tuckable. isItemTuckable walks
  // effective categories so a Set with a tuckable shirt correctly picks up
  // outfit-wide forceUntuck.
  const tuckable = isItemTuckable(r)
  const untucked = forceUntuck && tuckable
  // Layer order for the wrapper OutfitItem: single-garment uses the item's
  // own layer, containers use the parent's — but the parent's layer_order
  // fields are 0 (container category has no meaningful layer). That's fine:
  // wire-time expansion re-orders per child on the backend before sending
  // to sim-vis, so the OutfitItem-level layerOrder only controls the
  // sort within `entries` (deterministic, stable for equivalent selections).
  const layerOrder = untucked ? r.styleCategory.layer_order_untucked : r.styleCategory.layer_order
  // Container products: resolve the N child CSAs the shopper's (parent CSA)
  // selection expands to, and attach so toWireItems can flatten. Drop the
  // whole item when expansion fails — a container with a broken mapping
  // cannot render, and sending the parent CSA alone would 400 downstream
  // (the backend rejects parent CSAs as VTO items).
  let childCsaIds: number[] | undefined
  if (r.loadedProduct?.container) {
    const resolved = resolveContainerExpansion(r.loadedProduct, r.storage.colorwaySizeAssetId)
    if (!resolved) {
      return null
    }
    childCsaIds = resolved
  }
  const outfitItem: OutfitItem = {
    externalId: r.externalId,
    colorwaySizeAssetId: r.storage.colorwaySizeAssetId,
    ...(untucked ? { untucked: true as const } : {}),
    ...(childCsaIds ? { childCsaIds } : {}),
  }
  return { outfitItem, layerOrder, garmentCount: childCsaIds?.length ?? 1 }
}

// buildOutfit derives the wire-shape outfit (1..4 items, layer-ordered) plus a
// list of pre-warm alternate outfits keyed off `lastAddedExternalId`. Items
// without a chosen colorway_size_asset_id are dropped silently — the caller is
// responsible for auto-size-rec before invoking this.
export function buildOutfit(
  selectedExternalIds: ReadonlySet<string>,
  resolved: ResolvedFittingRoom,
  forceUntuck: boolean,
  lastAddedExternalId: string | null,
): Outfit {
  const entries: OutfitBuilderEntry[] = []
  let lastAddedResolved: ResolvedFittingRoomItem | null = null

  for (const r of resolved.items) {
    if (!selectedExternalIds.has(r.externalId)) {
      continue
    }
    if (r.externalId === lastAddedExternalId) {
      lastAddedResolved = r
    }
    const entry = makeOutfitItem(r, forceUntuck)
    if (entry) {
      entries.push(entry)
    }
  }

  entries.sort((a, b) => a.layerOrder - b.layerOrder)
  // Trim by garment count, not entry count: a 3-piece Set fills 3 wire
  // slots. computeAvailability blocks the add before we get here, but this
  // defensive slice keeps a stale selection from posting > 4 garments (e.g.
  // if the merchant's container-child count changed since the shopper
  // selected it).
  const items: OutfitItem[] = []
  let cumulativeGarments = 0
  for (const entry of entries) {
    if (cumulativeGarments + entry.garmentCount > MAX_OUTFIT_ITEMS) {
      break
    }
    items.push(entry.outfitItem)
    cumulativeGarments += entry.garmentCount
  }

  const alternates = buildAlternateOutfits(items, lastAddedResolved)
  return { items, alternates }
}

// buildAlternateOutfits generates pre-warm composition variants for
// `lastAddedResolved`: same outfit, that item's colorway_size_asset_id swapped
// to each other size that shares the currently-selected colorway. Returns []
// when `lastAddedResolved` is missing, has no chosen CSA, or has no
// loadedProduct to inspect.
export function buildAlternateOutfits(
  primary: OutfitItem[],
  lastAddedResolved: ResolvedFittingRoomItem | null,
): OutfitItem[][] {
  if (!lastAddedResolved || !lastAddedResolved.loadedProduct) {
    return []
  }
  const currentCsaId = lastAddedResolved.storage.colorwaySizeAssetId
  if (currentCsaId == null) {
    return []
  }
  if (!primary.some((i) => i.externalId === lastAddedResolved.externalId)) {
    return []
  }

  const sizeRec = lastAddedResolved.loadedProduct.sizeFitRecommendation
  let currentColorwayId: number | null = null
  for (const sz of sizeRec.available_sizes) {
    const found = sz.colorway_size_assets.find((c) => c.id === currentCsaId)
    if (found) {
      currentColorwayId = found.colorway_id
      break
    }
  }

  const out: OutfitItem[][] = []
  for (const sz of sizeRec.available_sizes) {
    const altCsa = sz.colorway_size_assets.find(
      (c) => c.id !== currentCsaId && (currentColorwayId == null || c.colorway_id === currentColorwayId),
    )
    if (!altCsa) {
      continue
    }
    // Container products: the alt is the same set at a different set-size;
    // re-resolve the N child CSAs at the new (parent size, colorway).
    // Skip the alt entirely if the merchant's mapping doesn't cover the alt
    // set-size — half-mapped containers shouldn't produce a broken prefetch.
    let altChildCsaIds: number[] | undefined
    if (lastAddedResolved.loadedProduct.container) {
      const resolved = resolveContainerExpansion(lastAddedResolved.loadedProduct, altCsa.id)
      if (!resolved) {
        continue
      }
      altChildCsaIds = resolved
    }
    const alternate = primary.map((it) =>
      it.externalId === lastAddedResolved.externalId
        ? {
            ...it,
            colorwaySizeAssetId: altCsa.id,
            ...(altChildCsaIds ? { childCsaIds: altChildCsaIds } : {}),
          }
        : it,
    )
    out.push(alternate)
  }
  return out
}
