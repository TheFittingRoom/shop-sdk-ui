import { useCallback, useEffect, useMemo, useState } from 'react'
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
  useResolvedFittingRoom,
} from '@/lib/fitting-room-data'
import { getLogger } from '@/lib/logger'
import { getStaticData, useMainStore } from '@/lib/store'
import { useCss } from '@/lib/theme'
import { useMobileSheetSnap } from '@/lib/use-mobile-sheet-snap'
import { applyFrameBaseUrl, getSizeLabelFromSize } from '@/lib/util'
import { DeviceLayout, OverlayName } from '@/lib/view'
import type { Availability, OutfitItem } from '@/lib/fitting-room-outfit'
import { buildOutfit, computeAvailability } from '@/lib/fitting-room-outfit'
import { DesktopLayout } from './desktop-layout'
import type { DetailMode } from './detail-accordion-item'
import type { MobileMode } from './mobile-layout'
import { MobileLayout } from './mobile-layout'
import { useVtoRequests } from '@/lib/use-vto-requests'

// Map our local OutfitItem shape (which carries the externalId for UI bookkeeping)
// to the wire shape expected by the VTO API.
function toWireItems(items: OutfitItem[]): VtoCompositionItem[] {
  return items.map((i) => ({
    colorway_size_asset_id: i.colorwaySizeAssetId,
    ...(i.untucked ? { untucked: true } : {}),
  }))
}

const logger = getLogger('overlays/fitting-room')

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

export default function FittingRoomOverlay() {
  const deviceLayout = useMainStore((state) => state.deviceLayout)
  const userIsLoggedIn = useMainStore((state) => state.userIsLoggedIn)
  const userHasAvatar = useMainStore((state) => state.userHasAvatar)
  const userProfile = useMainStore((state) => state.userProfile)
  const closeOverlay = useMainStore((state) => state.closeOverlay)
  const openOverlay = useMainStore((state) => state.openOverlay)
  const updateFittingRoomItem = useMainStore((state) => state.updateFittingRoomItem)
  const resolved = useResolvedFittingRoom()

  const [topOffset, setTopOffset] = useState<number>(0)
  const [selectedExternalIds, setSelectedExternalIds] = useState<Set<string>>(() => new Set())
  const [openAccordionItemId, setOpenAccordionItemId] = useState<string | null>(null)
  const [detailMode, setDetailMode] = useState<DetailMode>('compact')
  const [forceUntuck, setForceUntuck] = useState<boolean>(false)
  const [lastAddedExternalId, setLastAddedExternalId] = useState<string | null>(null)
  const [mobileMode, setMobileMode] = useState<MobileMode>('browse')

  const { snap: sheetSnap, setSnap: setSheetSnap, handleTouchStart: sheetTouchStart } = useMobileSheetSnap('collapsed')

  const isMobileLayout = deviceLayout === DeviceLayout.MOBILE_PORTRAIT || deviceLayout === DeviceLayout.TABLET_PORTRAIT

  const {
    request: requestVtoComposition,
    framesForOutfit,
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

  // canTuck: the tuck/untuck control (desktop pill + mobile per-item CTA) is
  // only meaningful when the outfit actually has something to tuck into — a
  // tuckable garment AND a non-tuckable garment layered above its tucked
  // position. A tuckable top with no bottom selected has nothing to tuck in
  // to, so every tuck control stays hidden.
  const canTuck = useMemo<boolean>(
    () =>
      selectedItems.some((top) => {
        const topCategory = top.styleCategory
        if (!topCategory?.tuckable) {
          return false
        }
        return selectedItems.some(
          (other) =>
            !!other.styleCategory &&
            !other.styleCategory.tuckable &&
            other.styleCategory.layer_order > topCategory.layer_order,
        )
      }),
    [selectedItems],
  )

  // Availability map for every fitting-room item.
  const availabilityByExternalId = useMemo<Record<string, Availability>>(() => {
    const out: Record<string, Availability> = {}
    for (const item of resolved.items) {
      out[item.externalId] = computeAvailability(item, selectedExternalIds, resolved)
    }
    return out
  }, [resolved, selectedExternalIds])

  // Auto-size-rec: when an item is selected and has no colorwaySizeAssetId yet,
  // pick the recommended size for its currently-stored color preference and
  // write back via updateFittingRoomItem so the choice persists.
  const ensureSizeForItem = useCallback(
    (item: ResolvedFittingRoomItem) => {
      if (item.storage.colorwaySizeAssetId != null) {
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
        if (openAccordionItemId === externalId) {
          setOpenAccordionItemId(null)
        }
      } else {
        nextSelected.add(externalId)
        ensureSizeForItem(item)
        setLastAddedExternalId(externalId)
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

  // Wire to the merchant's addToCart callback (StaticData) when configured.
  // The fitting-room may add ANY item, not just currentProduct — so we use the
  // top-level `addToCart` callback rather than `currentProduct.addToCart`.
  const handleAddToCart = useCallback(
    async (externalId: string) => {
      const { addToCart } = getStaticData()
      if (!addToCart) {
        logger.logWarn('No addToCart callback configured; skipping', { externalId })
        return
      }
      const item = resolved.items.find((i) => i.externalId === externalId)
      if (!item || !item.storage.size || !item.storage.color) {
        logger.logWarn('Cannot add to cart: missing size or color', {
          externalId,
          size: item?.storage.size,
          color: item?.storage.color,
        })
        return
      }
      try {
        await addToCart(externalId, { size: item.storage.size, color: item.storage.color })
        closeOverlay()
      } catch (error) {
        logger.logError('addToCart failed', { error, externalId })
      }
    },
    [resolved.items, closeOverlay],
  )

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
      if (openAccordionItemId === externalId) {
        setOpenAccordionItemId(null)
      }
    },
    [openAccordionItemId],
  )

  const handleTryItOn = useCallback(() => {
    setMobileMode('try-on')
    setSheetSnap('collapsed')
  }, [setSheetSnap])

  const handleBackToBrowse = useCallback(() => {
    setMobileMode('browse')
  }, [])

  // Clear the open-accordion id when it points at an item that's no longer
  // selected. New selections auto-open their own accordion in
  // handleSelectItem — this effect must NOT re-open on its own, otherwise
  // collapsing the last open section would immediately spring back open.
  // All sections collapsed is a valid state.
  useEffect(() => {
    if (openAccordionItemId && !selectedExternalIds.has(openAccordionItemId)) {
      setOpenAccordionItemId(null)
    }
  }, [openAccordionItemId, selectedExternalIds])

  // Derive the current outfit. Memoized so identity is stable when nothing
  // material changed (avoids re-firing the request effect on every render).
  const outfit = useMemo(
    () => buildOutfit(selectedExternalIds, resolved, forceUntuck, lastAddedExternalId),
    [selectedExternalIds, resolved, forceUntuck, lastAddedExternalId],
  )

  // Fire VTO for the primary outfit + pre-warm alternates. Gated on auth and
  // an existing avatar — anonymous / no-avatar users can still browse but
  // can't fire compositions (the redirect kicks in elsewhere). The alternate
  // pre-warm is speculative and gated behind config.features.vtoPrefetch.
  useEffect(() => {
    if (!userIsLoggedIn || !userHasAvatar) {
      return
    }
    if (outfit.items.length === 0) {
      return
    }
    requestVtoComposition(toWireItems(outfit.items), true)
    if (getStaticData().config.features.vtoPrefetch) {
      for (const alt of outfit.alternates) {
        requestVtoComposition(toWireItems(alt), false)
      }
    }
  }, [userIsLoggedIn, userHasAvatar, outfit, requestVtoComposition])

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
            frameUrls={frameUrls}
            sheetSnap={sheetSnap}
            sheetTouchStart={sheetTouchStart}
            onSelectItem={handleSelectItem}
            onRemoveItem={handleRemoveItem}
            onTryItOn={handleTryItOn}
            onBackToBrowse={handleBackToBrowse}
            onOpenAccordionItem={setOpenAccordionItemId}
            onChangeDetailMode={setDetailMode}
            onChangeSize={handleChangeSize}
            onAddToCart={handleAddToCart}
            onToggleUntuck={handleToggleUntuck}
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
            frameUrls={frameUrls}
            onSelectItem={handleSelectItem}
            onRemoveItem={handleRemoveItem}
            onOpenAccordionItem={setOpenAccordionItemId}
            onChangeDetailMode={setDetailMode}
            onChangeSize={handleChangeSize}
            onAddToCart={handleAddToCart}
            onToggleUntuck={handleToggleUntuck}
            onSignOut={handleSignOut}
          />
        )}
        {vtoError ? <Snackbar messageKey="fitting_room.vto_error" onDismiss={clearVtoError} /> : null}
      </div>
    </ModalFrame>
  )
}
