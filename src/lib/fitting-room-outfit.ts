import type { StyleCategory, StyleCategoryGroup } from '@/api/gen/responses'
import type { ResolvedFittingRoom, ResolvedFittingRoomItem } from '@/lib/fitting-room-data'

export type Availability = 'available' | 'selected' | 'disabled'

export const MAX_OUTFIT_ITEMS = 4

export interface OutfitItem {
  externalId: string
  colorwaySizeAssetId: number
  untucked?: true
}

export interface Outfit {
  items: OutfitItem[]
  alternates: OutfitItem[][]
}

// `StyleCategory.includes` / `excludes` are gen'd as `any[]` (Go []enums.StyleCategory).
// Normalize to plain strings so the rule check is straightforward.
function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const out: string[] = []
  for (const v of value) {
    if (typeof v === 'string') out.push(v)
    else if (v != null) out.push(String(v))
  }
  return out
}

function catName(c: StyleCategory): string {
  return String(c.name)
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

export function computeAvailability(
  item: ResolvedFittingRoomItem,
  selectedExternalIds: ReadonlySet<string>,
  resolved: ResolvedFittingRoom,
): Availability {
  if (selectedExternalIds.has(item.externalId)) {
    return 'selected'
  }
  if (selectedExternalIds.size >= MAX_OUTFIT_ITEMS) {
    return 'disabled'
  }
  if (!item.styleCategory) {
    return 'disabled'
  }

  const itemCat = item.styleCategory
  for (const sel of resolved.items) {
    if (!selectedExternalIds.has(sel.externalId)) continue
    if (!sel.styleCategory) continue
    if (!pairCompatible(sel.styleCategory, itemCat, sel.styleCategoryGroup)) {
      return 'disabled'
    }
  }
  return 'available'
}

interface OutfitBuilderEntry {
  outfitItem: OutfitItem
  layerOrder: number
}

function makeOutfitItem(r: ResolvedFittingRoomItem, forceUntuck: boolean): OutfitBuilderEntry | null {
  if (!r.styleCategory) return null
  if (r.storage.colorwaySizeAssetId == null) return null
  const tuckable = !!r.styleCategory.tuckable
  const untucked = forceUntuck && tuckable
  const layerOrder = untucked ? r.styleCategory.layer_order_untucked : r.styleCategory.layer_order
  const outfitItem: OutfitItem = {
    externalId: r.externalId,
    colorwaySizeAssetId: r.storage.colorwaySizeAssetId,
    ...(untucked ? { untucked: true as const } : {}),
  }
  return { outfitItem, layerOrder }
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
    if (!selectedExternalIds.has(r.externalId)) continue
    if (r.externalId === lastAddedExternalId) lastAddedResolved = r
    const entry = makeOutfitItem(r, forceUntuck)
    if (entry) entries.push(entry)
  }

  entries.sort((a, b) => a.layerOrder - b.layerOrder)
  const items = entries.slice(0, MAX_OUTFIT_ITEMS).map((e) => e.outfitItem)

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
  if (!lastAddedResolved || !lastAddedResolved.loadedProduct) return []
  const currentCsaId = lastAddedResolved.storage.colorwaySizeAssetId
  if (currentCsaId == null) return []
  if (!primary.some((i) => i.externalId === lastAddedResolved.externalId)) return []

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
    if (!altCsa) continue
    const alternate = primary.map((it) =>
      it.externalId === lastAddedResolved.externalId ? { ...it, colorwaySizeAssetId: altCsa.id } : it,
    )
    out.push(alternate)
  }
  return out
}
