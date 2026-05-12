import { useCallback, useEffect, useMemo, useState } from 'react'
import { ButtonT } from '@/components/button'
import { Loading } from '@/components/content/loading'
import { LinkT } from '@/components/link'
import { ModalFrame } from '@/components/modal'
import { TextT } from '@/components/text'
import { VtoCompositionItem } from '@/lib/api'
import { getAuthManager } from '@/lib/firebase'
import { ResolvedFittingRoomItem, useResolvedFittingRoom } from '@/lib/fitting-room-data'
import { getLogger } from '@/lib/logger'
import { getStaticData, useMainStore } from '@/lib/store'
import { useCss } from '@/lib/theme'
import { useMobileSheetSnap } from '@/lib/use-mobile-sheet-snap'
import { applyFrameBaseUrl, getSizeLabelFromSize } from '@/lib/util'
import { DeviceLayout, OverlayName } from '@/lib/view'
import { Availability, buildOutfit, computeAvailability, OutfitItem } from './availability'
import { DesktopLayout } from './desktop-layout'
import { DetailMode } from './detail-accordion-item'
import { MobileLayout, MobileMode } from './mobile-layout'
import { findCsaByLabel, findRecommendedColorSize, buildVtoProductDataFromResolved } from './product-data'
import { useVtoSubscriptions } from './use-vto-subscriptions'

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
  if (!getOverlayTopOffset) return 0
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
  const [zoomed, setZoomed] = useState<boolean>(false)

  const { snap: sheetSnap, setSnap: setSheetSnap, handleTouchStart: sheetTouchStart } =
    useMobileSheetSnap('collapsed')

  const isMobileLayout =
    deviceLayout === DeviceLayout.MOBILE_PORTRAIT || deviceLayout === DeviceLayout.TABLET_PORTRAIT

  const { request: requestVtoComposition, framesForOutfit, lastError: vtoError, clearError: clearVtoError } =
    useVtoSubscriptions()

  // Scroll lock + top-offset measurement
  useEffect(() => {
    const savedScrollY = window.scrollY
    if (savedScrollY > 0) window.scrollTo(0, 0)
    setTopOffset(measureTopOffset())
    const onResize = () => setTopOffset(measureTopOffset())
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      if (savedScrollY > 0) window.scrollTo(0, savedScrollY)
    }
  }, [])

  // selectedItems: resolved items in their fitting-room order, filtered by selection set.
  const selectedItems = useMemo<ResolvedFittingRoomItem[]>(
    () => resolved.items.filter((item) => selectedExternalIds.has(item.externalId)),
    [resolved.items, selectedExternalIds],
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
      if (item.storage.colorwaySizeAssetId != null) return
      const productData = buildVtoProductDataFromResolved(item)
      if (!productData) return
      const csa = findRecommendedColorSize(productData, item.storage.color)
      if (!csa) return
      const sizeRec = item.loadedProduct?.sizeFitRecommendation
      const sizeLabel = sizeRec
        ? getSizeLabelFromSize(sizeRec.recommended_size)
        : productData.recommendedSizeLabel
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
      if (!item) return
      const isSelected = selectedExternalIds.has(externalId)
      const nextSelected = new Set(selectedExternalIds)
      if (isSelected) {
        nextSelected.delete(externalId)
        if (openAccordionItemId === externalId) setOpenAccordionItemId(null)
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
      if (!item) return
      const productData = buildVtoProductDataFromResolved(item)
      if (!productData) return
      const csa = findCsaByLabel(productData, sizeLabel, item.storage.color)
      if (!csa) return
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

  const handleToggleZoom = useCallback(() => {
    setZoomed((prev) => !prev)
  }, [])

  const handleRemoveItem = useCallback(
    (externalId: string) => {
      setSelectedExternalIds((prev) => {
        if (!prev.has(externalId)) return prev
        const next = new Set(prev)
        next.delete(externalId)
        return next
      })
      if (openAccordionItemId === externalId) setOpenAccordionItemId(null)
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

  // Default-open: when the open item is no longer selected (or none open),
  // default to the most recently selected item on desktop.
  useEffect(() => {
    if (isMobileLayout) return
    if (openAccordionItemId && selectedExternalIds.has(openAccordionItemId)) return
    if (selectedItems.length === 0) {
      if (openAccordionItemId !== null) setOpenAccordionItemId(null)
      return
    }
    // Most recently selected = highest addedAt across selected.
    let mostRecent: ResolvedFittingRoomItem | null = null
    for (const item of selectedItems) {
      if (!mostRecent || item.storage.addedAt > mostRecent.storage.addedAt) {
        mostRecent = item
      }
    }
    if (mostRecent) setOpenAccordionItemId(mostRecent.externalId)
  }, [isMobileLayout, openAccordionItemId, selectedExternalIds, selectedItems])

  // Derive the current outfit. Memoized so identity is stable when nothing
  // material changed (avoids re-firing the request effect on every render).
  const outfit = useMemo(
    () => buildOutfit(selectedExternalIds, resolved, forceUntuck, lastAddedExternalId),
    [selectedExternalIds, resolved, forceUntuck, lastAddedExternalId],
  )

  // Fire VTO for the primary outfit + pre-warm alternates. Gated on auth and
  // an existing avatar — anonymous / no-avatar users can still browse but
  // can't fire compositions (the redirect kicks in elsewhere).
  useEffect(() => {
    if (!userIsLoggedIn || !userHasAvatar) return
    if (outfit.items.length === 0) return
    requestVtoComposition(toWireItems(outfit.items), true)
    for (const alt of outfit.alternates) {
      requestVtoComposition(toWireItems(alt), false)
    }
  }, [userIsLoggedIn, userHasAvatar, outfit, requestVtoComposition])

  // Frames for the currently-active outfit, OR the bare-avatar frames when
  // nothing is selected (so the user always sees their avatar in the pane).
  const frameUrls = useMemo<string[] | null>(() => {
    if (outfit.items.length === 0) {
      const bareFrames = userProfile?.avatar_frames
      if (!bareFrames || bareFrames.length === 0) return null
      const baseUrl = getStaticData().config.frames.baseUrl
      return bareFrames.map((u) => applyFrameBaseUrl(u, baseUrl))
    }
    return framesForOutfit(toWireItems(outfit.items))
  }, [outfit, framesForOutfit, userProfile])

  // Auth gate: fire at overlay-open time (mirrors vto-single). Anonymous
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
    snackbar: {
      position: 'absolute',
      left: '50%',
      bottom: '24px',
      transform: 'translateX(-50%)',
      padding: '12px 20px',
      borderRadius: '24px',
      backgroundColor: theme.color_fg_text,
      color: '#FFFFFF',
      fontSize: '13px',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      zIndex: 10,
      maxWidth: 'calc(100% - 32px)',
    },
    snackbarDismiss: {
      background: 'none',
      border: 'none',
      color: '#FFFFFF',
      fontSize: '16px',
      cursor: 'pointer',
    },
  }))

  const overlayStyle = {
    top: `${topOffset}px`,
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
  // the redirect lands. Match vto-single's gating behavior.
  const authResolved = userIsLoggedIn && userHasAvatar === true
  if (!authResolved) {
    return (
      <ModalFrame
        isOpen
        onRequestClose={closeOverlay}
        overlayStyle={overlayStyle}
        contentStyle={contentStyle}
      >
        <Loading />
      </ModalFrame>
    )
  }

  return (
    <ModalFrame
      isOpen
      onRequestClose={closeOverlay}
      overlayStyle={overlayStyle}
      contentStyle={contentStyle}
    >
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
                <LinkT
                  variant="underline"
                  css={css.emptySignOut}
                  t="fitting_room.sign_out"
                  onClick={handleSignOut}
                />
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
            zoomed={zoomed}
            frameUrls={frameUrls}
            onSelectItem={handleSelectItem}
            onRemoveItem={handleRemoveItem}
            onOpenAccordionItem={setOpenAccordionItemId}
            onChangeDetailMode={setDetailMode}
            onChangeSize={handleChangeSize}
            onAddToCart={handleAddToCart}
            onToggleUntuck={handleToggleUntuck}
            onToggleZoom={handleToggleZoom}
            onSignOut={handleSignOut}
          />
        )}
        {vtoError ? (
          <div css={css.snackbar}>
            <TextT variant="base" t="fitting_room.vto_error" />
            <button css={css.snackbarDismiss} onClick={clearVtoError} aria-label="Dismiss">
              ×
            </button>
          </div>
        ) : null}
      </div>
    </ModalFrame>
  )
}
