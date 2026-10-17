import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { VtoTuckLabelTuck } from '@/api/gen/enums'
import { ButtonT } from '@/components/button'
import { Loading } from '@/components/content/loading'
import { LinkT } from '@/components/link'
import { ModalFrame } from '@/components/modal'
import { Snackbar } from '@/components/snackbar'
import { TextT } from '@/components/text'
import type { VtoCompositionItem } from '@/lib/api'
import { getAuthManager } from '@/lib/firebase'
import type { ResolvedFittingRoomItem } from '@/lib/fitting-room-data'
import {
  buildVtoProductDataFromResolved,
  findCsaByLabel,
  findRecommendedColorSize,
  isItemNoFit,
  useResolvedFittingRoom,
} from '@/lib/fitting-room-data'
import { cartErrorDetail } from '@/lib/cart-error'
import { getLogger } from '@/lib/logger'
import { getStaticData, useMainStore } from '@/lib/store'
import { useCss } from '@/lib/theme'
import { useMobileSheetSnap } from '@/lib/use-mobile-sheet-snap'
import { applyFrameBaseUrl, getSizeLabelFromSize } from '@/lib/util'
import { DeviceLayout, OverlayName } from '@/lib/view'
import type { Availability, OutfitItem } from '@/lib/fitting-room-outfit'
import { buildOutfit, computeAvailability, getOutfitConflicts } from '@/lib/fitting-room-outfit'
import { DesktopLayout } from './desktop-layout'
import type { DetailMode } from './detail-accordion-item'
import type { MobileMode } from './mobile-layout'
import { MobileLayout } from './mobile-layout'
import { useVtoRequests } from '@/lib/use-vto-requests'

// Map our local OutfitItem shape (which carries the externalId for UI bookkeeping)
// to the wire shape expected by the VTO API.
//
// Container products fan out: `childCsaIds` was pre-resolved in
// makeOutfitItem/buildAlternateOutfits from the shopper's (parent CSA)
// selection. Each child CSA becomes its own wire item, so an N-piece Set
// contributes N items[] entries instead of 1. Non-container items keep the
// 1:1 mapping. `untucked` propagates uniformly to every tuckable child in the
// container — the PDP will surface a single tuck toggle in Phase C, but even
// today an ambient outfit-wide `forceUntuck` needs to reach every tuckable
// component of a Set.
function toWireItems(items: OutfitItem[]): VtoCompositionItem[] {
  return items.flatMap((i) => {
    const untuckFrag = i.untucked ? { untucked: true } : {}
    if (i.childCsaIds && i.childCsaIds.length > 0) {
      return i.childCsaIds.map((csaId) => ({
        colorway_size_asset_id: csaId,
        ...untuckFrag,
      }))
    }
    return [{ colorway_size_asset_id: i.colorwaySizeAssetId, ...untuckFrag }]
  })
}

const logger = getLogger('overlays/fitting-room')

// How long the "Removed X from your outfit" notice stays up.
const SWAP_NOTICE_MS = 5000

// Snackbars sit above the overlay's bottom controls rather than over them.
// Both layouts end in a 48px button inset 16px (desktop Add all to cart,
// mobile Try It On), so 80px clears it with a 16px gap. Mobile browse also
// floats Clear All just above that bar (bottom 96px, 30px tall), which a
// phone-width snackbar would cover, so it goes above that too.
const SNACKBAR_BOTTOM = '80px'
const SNACKBAR_BOTTOM_MOBILE_BROWSE = '140px'

function measureTopOffset(): number {
  const { getOverlayTopOffset } = getStaticData()
  if (!getOverlayTopOffset) {
    return 0
  }
  try {
    const offset = getOverlayTopOffset()
    return Number.isFinite(offset) && offset > 0 ? offset : 0
  } catch {
    return 0
  }
}

export interface FittingRoomOverlayProps {
  // externalId of a product to preselect on open — set when the overlay is
  // opened from the PDP "Try It On" CTA so the viewed product joins the outfit.
  preselectExternalId?: string
}

export default function FittingRoomOverlay({ preselectExternalId }: FittingRoomOverlayProps) {
  const deviceLayout = useMainStore((state) => state.deviceLayout)
  const userIsLoggedIn = useMainStore((state) => state.userIsLoggedIn)
  const userHasAvatar = useMainStore((state) => state.userHasAvatar)
  const userProfile = useMainStore((state) => state.userProfile)
  const closeOverlay = useMainStore((state) => state.closeOverlay)
  const openOverlay = useMainStore((state) => state.openOverlay)
  const updateFittingRoomItem = useMainStore((state) => state.updateFittingRoomItem)
  const removeFromFittingRoom = useMainStore((state) => state.removeFromFittingRoom)
  const clearFittingRoom = useMainStore((state) => state.clearFittingRoom)
  const resolved = useResolvedFittingRoom()

  const [topOffset, setTopOffset] = useState<number>(0)
  const [selectedExternalIds, setSelectedExternalIds] = useState<Set<string>>(() => new Set())
  // Bumped each time a product is added to the outfit (in handleSelectItem's
  // add branch). The AvatarPane → useAutoRotate hook plays one full rotation
  // each time this number changes. Undefined while dormant so the bare-
  // avatar baseline doesn't auto-rotate before any add has happened.
  const [autoRotateTrigger, setAutoRotateTrigger] = useState<number | undefined>(undefined)
  const [openAccordionItemId, setOpenAccordionItemId] = useState<string | null>(null)
  const [detailMode, setDetailMode] = useState<DetailMode>('compact')
  const [forceUntuck, setForceUntuck] = useState<boolean>(false)
  const [lastAddedExternalId, setLastAddedExternalId] = useState<string | null>(null)
  // The last add that evicted a clashing item (not just a same-category
  // swap), for the info snackbar and its Undo. `result` is the selection the
  // add produced: once the selection moves on from it, Undo would throw away
  // later changes, so the notice is dropped (see the effect below).
  const [swapNotice, setSwapNotice] = useState<{
    names: string[]
    previous: Set<string>
    result: Set<string>
    at: number
  } | null>(null)
  const [mobileMode, setMobileMode] = useState<MobileMode>('browse')

  const { snap: sheetSnap, setSnap: setSheetSnap, handleTouchStart: sheetTouchStart } = useMobileSheetSnap('collapsed')

  const isMobileLayout = deviceLayout === DeviceLayout.MOBILE_PORTRAIT || deviceLayout === DeviceLayout.TABLET_PORTRAIT

  const {
    request: requestVtoComposition,
    framesForOutfit,
    tuckControlForOutfit,
    lastError: vtoError,
    clearError: clearVtoError,
  } = useVtoRequests()

  // Scroll lock + top-offset measurement
  useEffect(() => {
    const savedScrollY = window.scrollY
    if (savedScrollY > 0) {
      window.scrollTo(0, 0)
    }
    setTopOffset(measureTopOffset())
    const onResize = () => setTopOffset(measureTopOffset())
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      if (savedScrollY > 0) {
        window.scrollTo(0, savedScrollY)
      }
    }
  }, [])

  // selectedItems: sorted by style-category group display_order, with stable
  // fitting-room order as the tiebreaker so items added within the same group
  // keep a deterministic position.
  const selectedItems = useMemo<ResolvedFittingRoomItem[]>(() => {
    const indexed = resolved.items
      .map((item, idx) => ({ item, idx }))
      .filter(({ item }) => selectedExternalIds.has(item.externalId))
    indexed.sort((a, b) => {
      const aOrder = a.item.styleCategoryGroup?.display_order ?? Number.MAX_SAFE_INTEGER
      const bOrder = b.item.styleCategoryGroup?.display_order ?? Number.MAX_SAFE_INTEGER
      if (aOrder !== bOrder) {
        return aOrder - bOrder
      }
      return a.idx - b.idx
    })
    return indexed.map(({ item }) => item)
  }, [resolved.items, selectedExternalIds])

  // Availability map for every fitting-room item.
  const availabilityByExternalId = useMemo<Record<string, Availability>>(() => {
    const out: Record<string, Availability> = {}
    for (const item of resolved.items) {
      out[item.externalId] = computeAvailability(item, selectedExternalIds, resolved)
    }
    return out
  }, [resolved, selectedExternalIds])

  // Auto-size-rec: when a selected item has no colorwaySizeAssetId yet, OR its
  // stored id has gone stale (item.needsResize — the CSA is no longer in the
  // current size rec, e.g. the style was re-saved/re-published and the row was
  // replaced, or the colorway/size was removed), fall back to the DEFAULT: the
  // recommended size for the item's stored colour preference, or the first
  // colorway when that colour is gone (findRecommendedColorSize handles both).
  // Write back via updateFittingRoomItem so the corrected choice persists and a
  // stale id is never sent to VTO.
  const ensureSizeForItem = useCallback(
    (item: ResolvedFittingRoomItem) => {
      if (item.storage.colorwaySizeAssetId != null && !item.needsResize) {
        return
      }
      const productData = buildVtoProductDataFromResolved(item)
      if (!productData) {
        return
      }
      const csa = findRecommendedColorSize(productData, item.storage.color)
      if (!csa) {
        return
      }
      const sizeRec = item.loadedProduct?.sizeFitRecommendation
      const sizeLabel = sizeRec ? getSizeLabelFromSize(sizeRec.recommended_size) : productData.recommendedSizeLabel
      updateFittingRoomItem(item.externalId, {
        colorwaySizeAssetId: csa.colorwaySizeAssetId,
        size: sizeLabel,
        color: csa.colorLabel,
      })
      logger.logDebug('Auto-picked recommended size', {
        externalId: item.externalId,
        sizeLabel,
        csaId: csa.colorwaySizeAssetId,
      })
    },
    [updateFittingRoomItem],
  )

  // Handle selecting/deselecting a card.
  const handleSelectItem = useCallback(
    (externalId: string) => {
      const item = resolved.items.find((i) => i.externalId === externalId)
      if (!item) {
        return
      }
      const isSelected = selectedExternalIds.has(externalId)
      const nextSelected = new Set(selectedExternalIds)
      if (isSelected) {
        nextSelected.delete(externalId)
      } else {
        // Swap: adding an item evicts every selected item it can't be worn
        // with (same category, or a composition-rule clash — a Set and a
        // standalone top, say). computeAvailability already reflects this
        // (clashes don't disable the new card), so the eviction is the
        // shopper's implicit choice.
        const evicted = getOutfitConflicts(item, selectedExternalIds, resolved).flatMap(
          (id) => resolved.items.find((i) => i.externalId === id) ?? [],
        )
        for (const e of evicted) {
          nextSelected.delete(e.externalId)
        }
        nextSelected.add(externalId)
        // A same-category swap (one pair of pants for another) explains
        // itself. Anything else — picking a shirt removing a whole Set —
        // gets a notice with Undo, naming everything that left.
        const itemCategory = item.styleCategory?.name
        if (evicted.some((e) => e.styleCategory?.name !== itemCategory)) {
          setSwapNotice({
            names: evicted.map((e) => e.merchantProduct?.productName ?? e.externalId),
            previous: selectedExternalIds,
            result: nextSelected,
            at: Date.now(),
          })
        }
        ensureSizeForItem(item)
        setLastAddedExternalId(externalId)
        // Trigger a one-shot auto-rotation when the new product's VTO frames
        // arrive (see useAutoRotate). Size/color changes don't bump this so
        // they don't fire a rotation; remove + re-add does because each add
        // increments.
        setAutoRotateTrigger((n) => (n ?? 0) + 1)
        // Desktop: open accordion to the newly-added item. Mobile: stay in browse.
        if (!isMobileLayout) {
          setOpenAccordionItemId(externalId)
          setDetailMode('compact')
        }
      }
      setSelectedExternalIds(nextSelected)
    },
    [resolved, selectedExternalIds, openAccordionItemId, isMobileLayout, ensureSizeForItem],
  )

  const handleChangeSize = useCallback(
    (externalId: string, sizeLabel: string) => {
      const item = resolved.items.find((i) => i.externalId === externalId)
      if (!item) {
        return
      }
      const productData = buildVtoProductDataFromResolved(item)
      if (!productData) {
        return
      }
      const csa = findCsaByLabel(productData, sizeLabel, item.storage.color)
      if (!csa) {
        return
      }
      updateFittingRoomItem(externalId, {
        colorwaySizeAssetId: csa.colorwaySizeAssetId,
        size: sizeLabel,
        color: csa.colorLabel,
      })
    },
    [resolved.items, updateFittingRoomItem],
  )

  // Mirror handleChangeSize but vary the colour for the currently-stored size.
  // Resolves to a CSA via findCsaByLabel and writes the new size/color/csaId.
  // When the item has no stored size yet (catalog-add path — shopper hasn't
  // opened the accordion to pick one), fall back to the recommended size
  // from the size-fit recommendation. Without this fallback, the rail-card
  // swatch row's colour click would early-return and silently do nothing
  // for fresh-from-catalog items.
  const handleChangeColor = useCallback(
    (externalId: string, colorLabel: string | null) => {
      const item = resolved.items.find((i) => i.externalId === externalId)
      if (!item) {
        return
      }
      const productData = buildVtoProductDataFromResolved(item)
      if (!productData) {
        return
      }
      const effectiveSize = item.storage.size ?? productData.recommendedSizeLabel
      if (!effectiveSize) {
        return
      }
      const csa = findCsaByLabel(productData, effectiveSize, colorLabel)
      if (!csa) {
        return
      }
      updateFittingRoomItem(externalId, {
        colorwaySizeAssetId: csa.colorwaySizeAssetId,
        size: effectiveSize,
        color: csa.colorLabel,
      })
    },
    [resolved.items, updateFittingRoomItem],
  )

  // Wire to the merchant's addToCart callback (StaticData) when configured.
  // The fitting-room may add ANY item, not just currentProduct — so we use the
  // top-level `addToCart` callback rather than `currentProduct.addToCart`.
  // A cart add that failed, for the error snackbar: which of our messages to
  // show, and the store's own reason when it gave one (see cartErrorDetail).
  const [cartError, setCartError] = useState<{ messageKey: string; detail: string | null } | null>(null)

  // Adds one item to the merchant's cart in its chosen size and colour.
  // Resolves to whether it went in, with the store's reason when it didn't.
  const addItemToCart = useCallback(
    async (externalId: string): Promise<{ ok: true } | { ok: false; detail: string | null }> => {
      const { addToCart } = getStaticData()
      if (!addToCart) {
        logger.logWarn('No addToCart callback configured; skipping', { externalId })
        return { ok: false, detail: null }
      }
      const item = resolved.items.find((i) => i.externalId === externalId)
      if (!item || !item.storage.size || !item.storage.color) {
        logger.logWarn('Cannot add to cart: missing size or color', {
          externalId,
          size: item?.storage.size,
          color: item?.storage.color,
        })
        return { ok: false, detail: null }
      }
      try {
        await addToCart(externalId, { size: item.storage.size, color: item.storage.color })
        return { ok: true }
      } catch (error) {
        logger.logError('addToCart failed', { error, externalId })
        return { ok: false, detail: cartErrorDetail(error) }
      }
    },
    [resolved.items],
  )

  // Single item: closes the overlay once it is in, as before; a failure keeps
  // it open with an error.
  const handleAddToCart = useCallback(
    async (externalId: string) => {
      setCartError(null)
      const result = await addItemToCart(externalId)
      if (result.ok) {
        closeOverlay()
        return
      }
      setCartError({ messageKey: 'fitting_room.add_to_cart_error', detail: result.detail })
    },
    [addItemToCart, closeOverlay],
  )

  // "Add all to cart": every selected item, one after another. Sequential on
  // purpose — the merchant callback adds one item per call, and concurrent
  // Shopify /cart/add requests can drop each other's additions. The overlay
  // closes once all of them are in; if any couldn't be added it stays open
  // with an error, showing the store's reason for the first that failed.
  const [addingAll, setAddingAll] = useState(false)
  // A selected item with no size that fits would go into the cart in a size
  // we say doesn't fit (or not at all), so Add all is off until it's
  // deselected or removed. Its row already says why.
  const selectionHasNoFit = useMemo(() => selectedItems.some(isItemNoFit), [selectedItems])
  const addAllToCartDisabled = addingAll || selectionHasNoFit
  const handleAddAllToCart = useCallback(async () => {
    if (selectionHasNoFit) {
      return
    }
    setAddingAll(true)
    setCartError(null)
    let failed = false
    let detail: string | null = null
    for (const item of selectedItems) {
      const result = await addItemToCart(item.externalId)
      if (!result.ok) {
        failed = true
        detail = detail ?? result.detail
      }
    }
    setAddingAll(false)
    if (failed) {
      setCartError({ messageKey: 'fitting_room.add_all_to_cart_error', detail })
      return
    }
    closeOverlay()
  }, [selectedItems, selectionHasNoFit, addItemToCart, closeOverlay])

  const handleToggleUntuck = useCallback(() => {
    setForceUntuck((prev) => !prev)
  }, [])

  const handleRemoveItem = useCallback(
    (externalId: string) => {
      setSelectedExternalIds((prev) => {
        if (!prev.has(externalId)) {
          return prev
        }
        const next = new Set(prev)
        next.delete(externalId)
        return next
      })
      // Drop the item from persisted storage so the rail card disappears
      // and the removal survives an overlay reopen / page reload. Without
      // this the X only deselected the item within the current overlay.
      removeFromFittingRoom(externalId)
    },
    [openAccordionItemId, removeFromFittingRoom],
  )

  // Undo restores the selection from before the swap. The added item stays in
  // the fitting room, just deselected; the evicted ones were only ever
  // deselected, so they come straight back.
  const handleUndoSwap = useCallback(() => {
    if (!swapNotice) {
      return
    }
    setSelectedExternalIds(new Set(swapNotice.previous))
    setSwapNotice(null)
  }, [swapNotice])

  // Drop the notice as soon as the selection is anything but what its swap
  // produced — another tap, a removal, Clear All — so Undo can only ever
  // reverse the change it describes.
  useEffect(() => {
    if (swapNotice && selectedExternalIds !== swapNotice.result) {
      setSwapNotice(null)
    }
  }, [selectedExternalIds, swapNotice])

  const handleTryItOn = useCallback(() => {
    setMobileMode('try-on')
    setSheetSnap('collapsed')
  }, [setSheetSnap])

  const handleBackToBrowse = useCallback(() => {
    setMobileMode('browse')
  }, [])

  // The open item stopped being selected (deselected, removed via its X, or
  // evicted by a clashing add). Hand the open state to another selected
  // item rather than leaving every section collapsed — at most one section is
  // open, and normally one *is*.
  //
  // This is the ONLY place that reacts to the open item leaving the selection.
  // The three call sites that drop an item used to clear the open id
  // themselves, which ran in the same batch as the selection update and left
  // this effect looking at an already-null id — so it never fired and the
  // hand-off silently did nothing.
  //
  // Zero-open remains valid, but only as something the shopper asks for by
  // collapsing the open section themselves. That path sets the id to null
  // without changing the selection, so this effect doesn't fire and nothing
  // springs back open. Keep that distinction: an unconditional "if nothing is
  // open, open something" would make the collapse control impossible to use.
  useEffect(() => {
    if (!openAccordionItemId || selectedExternalIds.has(openAccordionItemId)) {
      return
    }
    setOpenAccordionItemId(selectedItems[0]?.externalId ?? null)
  }, [openAccordionItemId, selectedExternalIds, selectedItems])

  // Mobile sheet snap == 'full': auto-open an accordion item so the body has
  // something to render. Mobile's quickRow content only renders in the
  // 'expanded' snap; in 'full' the accordion gates on `isOpen` and shows an
  // empty body when no item is open — which is exactly the state after the
  // second swipe-up (collapsed → expanded → full) on first try-on, before the
  // shopper has tapped a row. Prefer the most-recently-added item; fall back
  // to the first selected. Desktop never reaches sheetSnap='full' (no sheet),
  // so the snap check alone is enough.
  useEffect(() => {
    if (sheetSnap !== 'full' || openAccordionItemId !== null || selectedItems.length === 0) {
      return
    }
    const lastAddedSelected =
      lastAddedExternalId && selectedExternalIds.has(lastAddedExternalId) ? lastAddedExternalId : null
    setOpenAccordionItemId(lastAddedSelected ?? selectedItems[0].externalId)
  }, [sheetSnap, openAccordionItemId, selectedItems, lastAddedExternalId, selectedExternalIds])

  // Preselect the current PDP product when the overlay was opened from the
  // "Try It On" CTA. The CTA adds the product to the fitting room
  // asynchronously, so wait until both the storage entry AND its backing data
  // (merchantProduct + loadedProduct) have landed before running the normal
  // selection path. Without the load-complete gate, ensureSizeForItem fires
  // too early (buildVtoProductDataFromResolved returns null without
  // loadedProduct), leaves the new item's CSA as null, and the outfit
  // builder silently drops it — producing a bare avatar with no VTO.
  const preselectAppliedRef = useRef(false)
  useEffect(() => {
    if (preselectAppliedRef.current || !preselectExternalId) {
      return
    }
    const item = resolved.items.find((i) => i.externalId === preselectExternalId)
    if (!item || !item.merchantProduct || !item.loadedProduct) {
      return
    }
    preselectAppliedRef.current = true
    handleSelectItem(preselectExternalId)
  }, [preselectExternalId, resolved.items, handleSelectItem])

  // Derive the current outfit. Memoized so identity is stable when nothing
  // material changed (avoids re-firing the request effect on every render).
  const outfit = useMemo(
    () => buildOutfit(selectedExternalIds, resolved, forceUntuck, lastAddedExternalId),
    [selectedExternalIds, resolved, forceUntuck, lastAddedExternalId],
  )

  // The tuck control (desktop pill + mobile per-item CTA) is shown and worded
  // by the backend's ruling for this outfit, which arrives on the VTO
  // response: whether there is something to tuck into, whether the top must
  // stay untucked, and whether a dress makes it "Top Over" / "Top Under". Until
  // a response for these garments has arrived the control stays hidden — the
  // SDK does not second-guess the rules.
  const tuckControl = useMemo(() => tuckControlForOutfit(toWireItems(outfit.items)), [outfit, tuckControlForOutfit])
  const canTuck = tuckControl?.available ?? false
  const tuckLabel = tuckControl?.label ?? VtoTuckLabelTuck

  // Fire VTO for the primary outfit + pre-warm alternates. Gated on auth and
  // an existing avatar — anonymous / no-avatar users can still browse but
  // can't fire compositions (the redirect kicks in elsewhere). The alternate
  // pre-warm is speculative and gated behind config.features.vtoPrefetch.
  //
  // Mobile-browse is also gated: while the user is in the BrowseView the
  // avatar pane isn't visible, so the render would never reach the screen —
  // we'd be paying for compositions the shopper can't see. Holding the fire
  // until they tap "Try It On" (which flips mobileMode to 'try-on') means
  // the first render kicks off on view entry and shows the loading state
  // until it lands. Desktop is unaffected (isMobileLayout is false) and
  // keeps firing eagerly because the avatar pane is always visible there.
  useEffect(() => {
    if (!userIsLoggedIn || !userHasAvatar) {
      return
    }
    if (isMobileLayout && mobileMode === 'browse') {
      return
    }
    // An empty outfit goes through too: it tells the hook nothing is
    // selected, which drops alternates queued for the previous outfit.
    requestVtoComposition(toWireItems(outfit.items), true)
    if (getStaticData().config.features.vtoPrefetch) {
      for (const alt of outfit.alternates) {
        requestVtoComposition(toWireItems(alt), false)
      }
    }
  }, [userIsLoggedIn, userHasAvatar, isMobileLayout, mobileMode, outfit, requestVtoComposition])

  // Frames for the currently-active outfit, OR the bare-avatar frames when
  // nothing is selected (so the user always sees their avatar in the pane).
  const frameUrls = useMemo<string[] | null>(() => {
    if (outfit.items.length === 0) {
      const bareFrames = userProfile?.avatar_frames
      if (!bareFrames || bareFrames.length === 0) {
        return null
      }
      const baseUrl = getStaticData().config.frames.baseUrl
      return bareFrames.map((u) => applyFrameBaseUrl(u, baseUrl))
    }
    return framesForOutfit(toWireItems(outfit.items))
  }, [outfit, framesForOutfit, userProfile])

  // Auth gate: fire at overlay-open time (mirrors quick-view). Anonymous
  // users get bounced to LANDING; logged-in-but-no-avatar users get bounced
  // to GET_APP. Both pass returnToOverlay=FITTING_ROOM so the post-auth
  // flow brings them back here. userHasAvatar starts as null while the
  // user profile is loading — only redirect to GET_APP once it's
  // explicitly false.
  useEffect(() => {
    if (!userIsLoggedIn) {
      openOverlay(OverlayName.LANDING, { returnToOverlay: OverlayName.FITTING_ROOM })
      return
    }
    if (userHasAvatar === false) {
      openOverlay(OverlayName.GET_APP, { returnToOverlay: OverlayName.FITTING_ROOM, noAvatar: true })
    }
  }, [userIsLoggedIn, userHasAvatar, openOverlay])

  const handleSignOut = useCallback(() => {
    closeOverlay()
    const authManager = getAuthManager()
    authManager.logout().catch((error) => {
      logger.logError('Error during logout', { error })
    })
  }, [closeOverlay])

  // Clear All: wipe every entry from fitting-room storage AND reset overlay-
  // local state (selected set, open accordion) so the UI reflects the empty
  // room immediately without waiting for the next render-cycle decision.
  const handleClearAll = useCallback(() => {
    clearFittingRoom()
    setSelectedExternalIds(new Set())
    setOpenAccordionItemId(null)
  }, [clearFittingRoom])

  const handleShopNow = useCallback(() => {
    closeOverlay()
  }, [closeOverlay])

  const css = useCss((theme) => ({
    body: {
      width: '100%',
      height: '100%',
      overflow: 'hidden',
      boxSizing: 'border-box',
      backgroundColor: '#FFFFFF',
    },
    empty: {
      display: 'flex',
      width: '100%',
      height: '100%',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '32px',
    },
    emptyCard: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '16px',
      maxWidth: '420px',
      textAlign: 'center',
    },
    emptyTitle: {
      fontSize: '24px',
    },
    emptyTagline: {
      fontSize: '14px',
      color: theme.color_fg_text,
    },
    emptyShopNow: {
      width: 'min(100%, 240px)',
      marginTop: '8px',
    },
    emptySignOut: {
      fontSize: '13px',
      textDecoration: 'underline',
      marginTop: '8px',
    },
  }))

  // Browse mode sits below the merchant's page header (topOffset). Try-on
  // mode goes fullscreen — top: 0 — so the avatar image is flush with the
  // top of the screen.
  const isMobileTryOn = isMobileLayout && mobileMode === 'try-on'
  const snackbarBottom = isMobileLayout && !isMobileTryOn ? SNACKBAR_BOTTOM_MOBILE_BROWSE : SNACKBAR_BOTTOM
  const overlayStyle = {
    top: isMobileTryOn ? 0 : `${topOffset}px`,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
  }
  const contentStyle = {
    position: 'absolute' as const,
    inset: 0,
    margin: 0,
    padding: 0,
    border: 'none',
    borderRadius: 0,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden' as const,
  }

  // While the auth gate effect is deciding where to send us (or while the
  // user profile is still loading), don't render the overlay's body — we'd
  // either flash an empty rails view or briefly render the layout before
  // the redirect lands. Match quick-view's gating behavior.
  const authResolved = userIsLoggedIn && userHasAvatar === true
  if (!authResolved) {
    return (
      <ModalFrame isOpen onRequestClose={closeOverlay} overlayStyle={overlayStyle} contentStyle={contentStyle}>
        <Loading />
      </ModalFrame>
    )
  }

  return (
    <ModalFrame isOpen onRequestClose={closeOverlay} overlayStyle={overlayStyle} contentStyle={contentStyle}>
      <div css={css.body}>
        {resolved.items.length === 0 ? (
          <div css={css.empty}>
            <div css={css.emptyCard}>
              <TextT variant="brand" css={css.emptyTitle} t="fitting_room.title" />
              <TextT variant="base" css={css.emptyTagline} t="landing.description" />
              <div css={css.emptyShopNow}>
                <ButtonT variant="primary" t="fitting_room.shop_now" onClick={handleShopNow} />
              </div>
              {userIsLoggedIn ? (
                <LinkT variant="underline" css={css.emptySignOut} t="fitting_room.sign_out" onClick={handleSignOut} />
              ) : null}
            </div>
          </div>
        ) : isMobileLayout ? (
          <MobileLayout
            mode={mobileMode}
            resolved={resolved}
            selectedItems={selectedItems}
            availabilityByExternalId={availabilityByExternalId}
            openAccordionItemId={openAccordionItemId}
            detailMode={detailMode}
            forceUntuck={forceUntuck}
            canTuck={canTuck}
            tuckLabel={tuckLabel}
            frameUrls={frameUrls}
            autoRotateTrigger={autoRotateTrigger}
            sheetSnap={sheetSnap}
            sheetTouchStart={sheetTouchStart}
            onSelectItem={handleSelectItem}
            onRemoveItem={handleRemoveItem}
            onTryItOn={handleTryItOn}
            onBackToBrowse={handleBackToBrowse}
            onOpenAccordionItem={setOpenAccordionItemId}
            onChangeDetailMode={setDetailMode}
            onChangeSize={handleChangeSize}
            onChangeColor={handleChangeColor}
            onAddToCart={handleAddToCart}
            onAddAllToCart={handleAddAllToCart}
            addAllToCartDisabled={addAllToCartDisabled}
            onToggleUntuck={handleToggleUntuck}
            onSignOut={handleSignOut}
            onClearAll={handleClearAll}
          />
        ) : (
          <DesktopLayout
            resolved={resolved}
            selectedItems={selectedItems}
            availabilityByExternalId={availabilityByExternalId}
            openAccordionItemId={openAccordionItemId}
            detailMode={detailMode}
            forceUntuck={forceUntuck}
            canTuck={canTuck}
            tuckLabel={tuckLabel}
            frameUrls={frameUrls}
            autoRotateTrigger={autoRotateTrigger}
            onSelectItem={handleSelectItem}
            onRemoveItem={handleRemoveItem}
            onOpenAccordionItem={setOpenAccordionItemId}
            onChangeDetailMode={setDetailMode}
            onChangeSize={handleChangeSize}
            onChangeColor={handleChangeColor}
            onAddToCart={handleAddToCart}
            onAddAllToCart={handleAddAllToCart}
            addAllToCartDisabled={addAllToCartDisabled}
            onToggleUntuck={handleToggleUntuck}
            onSignOut={handleSignOut}
            onClearAll={handleClearAll}
          />
        )}
        {vtoError ? (
          <Snackbar messageKey="fitting_room.vto_error" bottom={snackbarBottom} onDismiss={clearVtoError} />
        ) : null}
        {cartError ? (
          <Snackbar
            messageKey={cartError.messageKey}
            detail={cartError.detail}
            bottom={snackbarBottom}
            onDismiss={() => setCartError(null)}
          />
        ) : null}
        {swapNotice && !vtoError && !cartError ? (
          <Snackbar
            key={swapNotice.at}
            variant="info"
            messageKey="fitting_room.swap_removed"
            messageVars={{ names: swapNotice.names.join(', ') }}
            action={{ labelKey: 'fitting_room.undo', onClick: handleUndoSwap }}
            autoDismissMs={SWAP_NOTICE_MS}
            bottom={snackbarBottom}
            onDismiss={() => setSwapNotice(null)}
          />
        ) : null}
      </div>
    </ModalFrame>
  )
}
