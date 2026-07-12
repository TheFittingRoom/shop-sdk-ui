import type { ReactNode } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AddToCartButton } from '@/components/add-to-cart-button'
import { AvatarFrameViewer } from '@/components/avatar-frame-viewer'
import { useAutoRotate } from '@/components/use-auto-rotate'
import { Button } from '@/components/button'
import { ColorSelector } from '@/components/color-selector'
import { FitChart } from '@/components/content/fit-chart'
import { Loading } from '@/components/content/loading'
import { ItemFitDetails } from '@/components/item-fit-details'
import { ItemFitText } from '@/components/item-fit-text'
import { LinkT } from '@/components/link'
import { ModalTitlebar, SidecarModalFrame } from '@/components/modal'
import { SizeSelector } from '@/components/size-selector'
import { Snackbar } from '@/components/snackbar'
import { Text, TextT } from '@/components/text'
import { ZoomModal } from '@/components/zoom-modal'
import {
  AVATAR_BOTTOM_BACKGROUND_URL,
  CloseIcon,
  DragHandleIcon,
  FittingRoomIcon,
  InfoIcon,
  TfrNameSvg,
  ZoomIcon,
} from '@/lib/asset'
import { getAuthManager } from '@/lib/firebase'
import { toggleFittingRoomItem } from '@/lib/fitting-room-storage'
import { useTranslation } from '@/lib/locale'
import { getLogger } from '@/lib/logger'
import type { LoadedProductData, VtoProductData, VtoSizeColorData, VtoSizeData } from '@/lib/product'
import { buildVtoWireItems, loadProductDataToStore } from '@/lib/product'
import { loadStyleCategoryIndex } from '@/lib/style-categories'
import { getStaticData, useMainStore } from '@/lib/store'
import type { CssProp, StyleProp } from '@/lib/theme'
import { getThemeData, useCss } from '@/lib/theme'
import { getSizeLabelFromSize } from '@/lib/util'
import { useMobileSheetSnap } from '@/lib/use-mobile-sheet-snap'
import { DeviceLayout, OverlayName } from '@/lib/view'
import { useVtoRequests } from '@/lib/use-vto-requests'

interface ElementSize {
  width: number
  height: number
}

const AVATAR_IMAGE_ASPECT_RATIO = 2 / 3 // width:height
const AVATAR_GUTTER_HEIGHT_PX = 100
const CONTENT_AREA_WIDTH_PX = 550

// Rotation slider below the desktop avatar. Hidden 2026-05-24 — fitting-room
// has no equivalent and the drag-on-image gesture already handles rotation.
// Flip to true to restore the slider; the surrounding gutter, styles, and
// frame-index state all stay wired up for that.
const SHOW_ROTATION_SLIDER = false

// On desktop, image height = screen height − gutter (and width is derived from
// that), so collapsing the gutter when the slider is hidden lets the avatar
// fill the available height. The mobile branch keeps `AVATAR_GUTTER_HEIGHT_PX`
// regardless — its gutter exists to leave room for the collapsed product-
// details popover, not for the slider.
const DESKTOP_AVATAR_GUTTER_HEIGHT_PX = SHOW_ROTATION_SLIDER ? AVATAR_GUTTER_HEIGHT_PX : 0

const logger = getLogger('overlays/quick-view')

export default function QuickViewOverlay() {
  const userIsLoggedIn = useMainStore((state) => state.userIsLoggedIn)
  const userHasAvatar = useMainStore((state) => state.userHasAvatar)
  const userProfile = useMainStore((state) => state.userProfile)
  const storeProductData = useMainStore((state) => state.productData)
  const deviceLayout = useMainStore((state) => state.deviceLayout)
  const openOverlay = useMainStore((state) => state.openOverlay)
  const closeOverlay = useMainStore((state) => state.closeOverlay)
  const updateFittingRoomItem = useMainStore((state) => state.updateFittingRoomItem)
  const fittingRoomItems = useMainStore((state) => state.fittingRoom)
  const [vtoProductData, setVtoProductData] = useState<VtoProductData | false | null>(null)
  const [selectedSizeLabel, setSelectedSizeLabel] = useState<string | null>(null)
  const [selectedColorLabel, setSelectedColorLabel] = useState<string | null>(null)
  const [modalStyle, setModalStyle] = useState<StyleProp>({})
  // Shared VTO request flow: dedup, prefetch throttle, and frame storage.
  // Single-garment compositions are just one-item outfits (untucked: false).
  const { request: vtoRequest, framesForOutfit, lastError: vtoError, clearError: clearVtoError } = useVtoRequests()

  // Redirect if not logged in or no avatar
  useEffect(() => {
    if (!userIsLoggedIn) {
      openOverlay(OverlayName.LANDING, { returnToOverlay: OverlayName.QUICK_VIEW })
      return
    }
    if (userIsLoggedIn && userHasAvatar === false) {
      openOverlay(OverlayName.GET_APP, { returnToOverlay: OverlayName.QUICK_VIEW, noAvatar: true })
      return
    }
  }, [userIsLoggedIn, userHasAvatar, openOverlay])

  // On load, load store product data (in case not already loaded)
  useEffect(() => {
    const { currentProduct } = getStaticData()
    if (!currentProduct) {
      return
    }
    loadProductDataToStore(currentProduct.externalId)
  }, [])

  // On load, generate vto product data from store product data + user selections
  useEffect(() => {
    async function setupInitialVtoData() {
      try {
        const { currentProduct } = getStaticData()
        if (!currentProduct) {
          return
        }
        const storeProduct = storeProductData[currentProduct.externalId]
        if (!storeProduct) {
          return
        }
        if ('error' in storeProduct) {
          throw storeProduct.error
        }

        // Get external product data
        const { productName, productDescriptionHtml, variants } = currentProduct

        // Get user selections from page
        const { color: selectedColor } = await currentProduct.getSelectedOptions()

        // Assemble vto product data. The product-summary row shows the
        // per-category *singular* label (e.g. "Top"), matching what the
        // fitting-room accordion header uses. The style-category group's
        // label is plural ("Tops") and lacks a singular form, so we go
        // through `byName` for the StyleCategory itself, which carries
        // `label_singular`.
        const styleCategoryIndex = await loadStyleCategoryIndex()
        const styleCategoryRecord = styleCategoryIndex.byName(storeProduct.style.style_category_name)
        const styleCategoryLabel = styleCategoryRecord?.label_singular ?? styleCategoryRecord?.label ?? null
        const sizeRecommendationRecord = storeProduct.sizeFitRecommendation
        {
          const recommendedSizeId = sizeRecommendationRecord.recommended_size.id || null
          const recommendedSizeLabel = getSizeLabelFromSize(sizeRecommendationRecord.recommended_size)
          if (recommendedSizeId == null || recommendedSizeLabel == null) {
            throw new Error(`No recommended size found for externalId: ${currentProduct.externalId}`)
          }
          let vtoProductData: VtoProductData
          {
            const fitClassification = sizeRecommendationRecord.fit_classification
            const sizes: VtoSizeData[] = []
            for (const sizeRec of sizeRecommendationRecord.available_sizes) {
              const sizeId = sizeRec.id
              const sizeLabel = getSizeLabelFromSize(sizeRec) || null
              if (!sizeLabel) {
                continue
              }
              const isRecommended = sizeRec.id === recommendedSizeId
              const fit = sizeRecommendationRecord.fits.find((f) => f.size_id === sizeRec.id)
              if (!fit) {
                continue
              }
              const colors: VtoSizeColorData[] = []
              for (const csaRec of sizeRec.colorway_size_assets) {
                const colorwaySizeAssetId = csaRec.id
                const sku = csaRec.sku
                const variant = variants.find((v) => v.sku === sku)
                if (!variant) {
                  logger.logWarn(
                    `Variant not found for externalId: ${currentProduct.externalId} sizeId: ${sizeId} sku: ${sku}`,
                  )
                  continue
                }
                const colorLabel = variant.color || null
                const priceFormatted = variant.priceFormatted
                colors.push({
                  colorwaySizeAssetId,
                  colorLabel,
                  sku,
                  priceFormatted,
                })
              }
              if (!colors.length) {
                logger.logWarn(
                  `No valid colorways found for externalId: ${currentProduct.externalId} sizeId: ${sizeId}`,
                )
                continue
              }
              sizes.push({
                sizeId,
                sizeLabel,
                isRecommended,
                fit,
                colors,
              })
            }
            if (!sizes.length) {
              throw new Error(`No valid sizes found for externalId: ${currentProduct.externalId}`)
            }
            vtoProductData = {
              productName,
              productDescriptionHtml,
              fitClassification,
              recommendedSizeId,
              recommendedSizeLabel,
              sizes,
              styleCategoryLabel,
            }
          }
          let recommendedColorLabel: string | null = null
          {
            const recommendedSizeRecord = vtoProductData.sizes.find((s) => s.isRecommended)
            if (!recommendedSizeRecord) {
              throw new Error('Recommended size record not found')
            }
            if (!recommendedSizeRecord.colors.length) {
              throw new Error('No colorways found for recommended size record')
            }
            const recommendedSizeColorRecord =
              recommendedSizeRecord.colors.find((c) => {
                return c.colorLabel === selectedColor
              }) || recommendedSizeRecord.colors[0]

            recommendedColorLabel = recommendedSizeColorRecord?.colorLabel ?? null
          }
          setVtoProductData(vtoProductData)
          setSelectedSizeLabel(recommendedSizeLabel)
          setSelectedColorLabel(recommendedColorLabel)
        }

        // (Legacy `userProfile.vto[brandId][sku]` ready-marking removed:
        // tokens are tracked per session against the new vto_compositions
        // subcollection, populated as the user navigates colors/sizes.)
      } catch (error) {
        logger.logError('Error fetching initial data:', { error })
        setVtoProductData(false)
        setSelectedSizeLabel(null)
        setSelectedColorLabel(null)
      }
    }
    if (vtoProductData !== null) {
      return
    }
    void setupInitialVtoData()
  }, [storeProductData, vtoProductData, userProfile])

  // Derive selected color/size data from selections
  const { sizeColorRecord: selectedColorSizeRecord, availableColorLabels } = useMemo(() => {
    if (!vtoProductData) {
      return { sizeColorRecord: null, availableColorLabels: [] }
    }
    const sizeRecord = vtoProductData.sizes.find((s) => s.sizeLabel === selectedSizeLabel)
    if (!sizeRecord || !sizeRecord.colors.length) {
      return { sizeColorRecord: null, availableColorLabels: [] }
    }
    const sizeColorRecord = sizeRecord.colors.find((c) => c.colorLabel === selectedColorLabel) ?? sizeRecord.colors[0]
    const availableColorLabels = sizeRecord.colors.map((c) => c.colorLabel).filter((label): label is string => !!label)
    return { sizeColorRecord, availableColorLabels }
  }, [vtoProductData, selectedSizeLabel, selectedColorLabel])

  // The loaded product data — pulled from the same store slot the
  // setupInitialVtoData effect reads. Container products need it at
  // wire-request time to expand into N child CSAs.
  const loadedProduct = useMemo<LoadedProductData | null>(() => {
    const { currentProduct } = getStaticData()
    if (!currentProduct) {
      return null
    }
    const entry = storeProductData[currentProduct.externalId]
    if (!entry || 'error' in entry) {
      return null
    }
    return entry
  }, [storeProductData])

  // Request VTO for a color/size as a one-item outfit. Dedup, the prefetch
  // throttle, and frame storage all live in the shared useVtoRequests hook;
  // single-garment compositions are never untucked. Container products fan
  // out at wire-build time via buildVtoWireItems; buildVtoWireItems returns
  // null when the container's mapping is incomplete and we skip the request
  // rather than post a broken composition.
  const requestVto = useCallback(
    (sizeColorRecord: VtoSizeColorData, priority: boolean) => {
      if (!loadedProduct) {
        return
      }
      const wireItems = buildVtoWireItems(loadedProduct, sizeColorRecord.colorwaySizeAssetId, false)
      if (!wireItems) {
        return
      }
      vtoRequest(wireItems, priority)
    },
    [vtoRequest, loadedProduct],
  )

  // Trigger priority VTO request when size/color selection changes
  useEffect(() => {
    if (selectedColorSizeRecord) {
      requestVto(selectedColorSizeRecord, true)
    }
  }, [requestVto, selectedColorSizeRecord])

  // Speculatively pre-fetch VTO for all recommended sizes when color
  // selection changes. Gated behind config.features.vtoPrefetch — the
  // priority request for the actively-selected size always fires (above).
  useEffect(() => {
    if (!getStaticData().config.features.vtoPrefetch) {
      return
    }
    if (!vtoProductData) {
      return
    }
    for (const sizeRecord of vtoProductData.sizes) {
      const sizeColorRecord = sizeRecord.colors.find((c) => c.colorLabel === selectedColorLabel) ?? sizeRecord.colors[0]
      if (sizeColorRecord) {
        requestVto(sizeColorRecord, false)
      }
    }
  }, [requestVto, vtoProductData, selectedColorLabel])

  // Frame URLs for the currently-selected color/size: ask the shared hook
  // for this one-item outfit's rendered frames (already base-URL-rewritten),
  // then preload the images. For containers the outfit key is the expanded
  // set of child CSAs — same as what requestVto posted, so the hook's
  // per-outfit frames Map has an entry keyed off the same wire shape.
  const frameUrls = useMemo(() => {
    if (!selectedColorSizeRecord || !loadedProduct) {
      return null
    }
    const wireItems = buildVtoWireItems(loadedProduct, selectedColorSizeRecord.colorwaySizeAssetId, false)
    if (!wireItems) {
      return null
    }
    const rewritten = framesForOutfit(wireItems)
    if (!rewritten) {
      return null
    }
    logger.logDebug(`{{ts}} - Displaying VTO for sku: ${selectedColorSizeRecord.sku}`)
    rewritten.forEach((url) => {
      const img = new Image()
      img.src = url
    })
    return rewritten
  }, [selectedColorSizeRecord, framesForOutfit, loadedProduct])

  const handleSignOutClick = useCallback(() => {
    closeOverlay()
    const authManager = getAuthManager()
    authManager.logout().catch((error) => {
      logger.logError('Error during logout:', { error })
    })
  }, [closeOverlay])
  // Wrap the color setter so a color change inside quick-view also persists
  // to the fitting-room storage entry for the current product (when it's
  // already in the room). Without this, changing color here and then opening
  // the fitting-room overlay later would show the *previously stored* color,
  // not what the shopper actually picked — and the rail card would render
  // the wrong variant image.
  const handleChangeColor = useCallback(
    (newColorLabel: string | null) => {
      setSelectedColorLabel(newColorLabel)
      const currentProduct = getStaticData().currentProduct
      if (!currentProduct) {
        return
      }
      const inRoom = fittingRoomItems.some((item) => item.externalId === currentProduct.externalId)
      if (!inRoom || !vtoProductData || !selectedSizeLabel) {
        return
      }
      const sizeRec = vtoProductData.sizes.find((s) => s.sizeLabel === selectedSizeLabel)
      const csa = sizeRec?.colors.find((c) => c.colorLabel === newColorLabel)
      if (!csa) {
        return
      }
      updateFittingRoomItem(currentProduct.externalId, {
        colorwaySizeAssetId: csa.colorwaySizeAssetId,
        size: selectedSizeLabel,
        color: csa.colorLabel,
      })
    },
    [fittingRoomItems, selectedSizeLabel, updateFittingRoomItem, vtoProductData],
  )
  const handleAddToCartClick = useCallback(async () => {
    try {
      if (!selectedSizeLabel) {
        return
      }
      const { currentProduct } = getStaticData()
      if (!currentProduct) {
        return
      }

      closeOverlay()
      await currentProduct.addToCart({ size: selectedSizeLabel, color: selectedColorLabel })
    } catch (error) {
      logger.logError('Error adding to cart:', { error })
    }
  }, [closeOverlay, selectedColorLabel, selectedSizeLabel])

  // RENDERING:

  if (vtoProductData === false) {
    return (
      <SidecarModalFrame onRequestClose={closeOverlay}>
        <NoFitLayout onClose={closeOverlay} onSignOut={handleSignOutClick} />
      </SidecarModalFrame>
    )
  }

  if (!userIsLoggedIn || !userHasAvatar || vtoProductData == null || !selectedColorSizeRecord) {
    return (
      <SidecarModalFrame onRequestClose={closeOverlay}>
        <Loading />
      </SidecarModalFrame>
    )
  }

  let Layout: React.FC<LayoutProps>
  if (deviceLayout === DeviceLayout.MOBILE_PORTRAIT || deviceLayout === DeviceLayout.TABLET_PORTRAIT) {
    Layout = MobileLayout
  } else {
    Layout = DesktopLayout
  }

  return (
    <SidecarModalFrame onRequestClose={closeOverlay} contentStyle={modalStyle}>
      <Layout
        loadedProductData={vtoProductData}
        selectedColorSizeRecord={selectedColorSizeRecord}
        availableColorLabels={availableColorLabels}
        selectedColorLabel={selectedColorLabel}
        selectedSizeLabel={selectedSizeLabel}
        frameUrls={frameUrls}
        setModalStyle={setModalStyle}
        onClose={closeOverlay}
        onChangeColor={handleChangeColor}
        onChangeSize={setSelectedSizeLabel}
        onAddToCart={handleAddToCartClick}
        onSignOut={handleSignOutClick}
      />
      {vtoError ? <Snackbar messageKey="quick-view.vto_error" onDismiss={clearVtoError} /> : null}
    </SidecarModalFrame>
  )
}

function NoFitLayout({ onClose, onSignOut }: { onClose: () => void; onSignOut: () => void }) {
  const { t } = useTranslation()
  const css = useCss((_theme) => ({
    mainContainer: {
      width: '100%',
      height: '100%',
      padding: '16px',
    },
    titlebarContainer: {},
    contentContainer: {
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
    },
    messageContainer: {
      marginTop: '32px',
      textAlign: 'center',
    },
    footerContainer: {
      marginTop: '32px',
    },
  }))
  return (
    <div css={css.mainContainer}>
      <div css={css.titlebarContainer}>
        <ModalTitlebar title={t('quick-view.title')} onCloseClick={onClose} />
      </div>
      <div css={css.contentContainer}>
        <div>&nbsp;</div>
        <div css={css.messageContainer}>
          <TextT variant="base" t="quick-view.no_recommendation" />
        </div>
        <div css={css.footerContainer}>
          <Footer onSignOutClick={onSignOut} />
        </div>
      </div>
    </div>
  )
}

// FittingRoomToggleButton sits beneath the Add to Cart CTA: it adds or
// removes the current PDP product from the fitting room (the localStorage
// item set), with a hanger icon and a state-aware label.
function FittingRoomToggleButton() {
  const { currentProduct } = getStaticData()
  const productId = currentProduct?.externalId ?? null
  const isInFittingRoom = useMainStore((state) =>
    productId == null ? false : state.fittingRoom.some((item) => item.externalId === productId),
  )
  const css = useCss((theme) => ({
    button: {
      marginTop: '10px',
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '10px',
      padding: '13px',
      backgroundColor: '#FFFFFF',
      border: `1px solid ${theme.color_fg_text}`,
      borderRadius: '30px',
      cursor: 'pointer',
    },
    icon: {
      color: theme.color_fg_text,
      width: '20px',
      height: '20px',
    },
    text: {
      fontSize: '14px',
      textTransform: 'uppercase',
    },
  }))

  if (productId == null) {
    return null
  }

  const handleClick = () => {
    // quick-view always renders for the current PDP product, so isPdp=true.
    toggleFittingRoomItem(productId, currentProduct?.handle ?? null, true).catch((error) => {
      logger.logError('toggleFittingRoomItem failed', { error })
    })
  }

  return (
    <button type="button" onClick={handleClick} css={css.button}>
      <FittingRoomIcon css={css.icon} />
      <TextT variant="base" css={css.text} t={isInFittingRoom ? 'added_to_fitting_room' : 'add_to_fitting_room'} />
    </button>
  )
}

interface LayoutProps {
  loadedProductData: VtoProductData
  selectedColorSizeRecord: VtoSizeColorData
  availableColorLabels: string[]
  selectedColorLabel: string | null
  selectedSizeLabel: string | null
  frameUrls: string[] | null
  setModalStyle: (style: StyleProp) => void
  onClose: () => void
  onChangeColor: (newColorLabel: string | null) => void
  onChangeSize: (newSizeLabel: string) => void
  onAddToCart: () => void
  onSignOut: () => void
}

type MobileContentView = 'collapsed' | 'expanded' | 'full'

function MobileLayout({
  loadedProductData,
  selectedColorSizeRecord,
  availableColorLabels,
  selectedColorLabel,
  selectedSizeLabel,
  frameUrls,
  setModalStyle,
  onClose,
  onChangeColor,
  onChangeSize,
  onAddToCart,
  onSignOut,
}: LayoutProps) {
  const {
    snap: contentView,
    setSnap: setContentView,
    handleTouchStart: handleBottomFrameTouchStart,
  } = useMobileSheetSnap('collapsed')
  const bottomFrameInnerRef = useRef<HTMLDivElement>(null)
  const [bottomFrameOuterStyle, setBottomFrameOuterStyle] = useState<StyleProp>({})
  const [bottomFrameInnerStyle, setBottomFrameInnerStyle] = useState<StyleProp>({})
  const css = useCss((_theme) => ({
    mainContainer: {
      width: '100%',
      height: '100%',
    },
    closeButton: {
      position: 'absolute',
      top: '12px',
      right: '10px',
      width: '30px',
      height: '30px',
      border: 'none',
      borderRadius: '15px',
      backgroundColor: 'rgba(255, 255, 255, 0.15)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
    closeIcon: {
      width: '16px',
      height: '16px',
    },
    bottomFrameOuter: {
      position: 'absolute',
      width: 'calc(100% - 16px)',
      maxWidth: `${CONTENT_AREA_WIDTH_PX}px`,
      bottom: '0',
      maxHeight: '95vh',
      left: '50%',
      transform: 'translateX(-50%)',
      backgroundColor: 'rgba(255, 255, 255, 0.9)',
      borderTopLeftRadius: '28px',
      borderTopRightRadius: '28px',
      borderTop: '1px solid rgba(0, 0, 0, 0.1)',
      borderLeft: '1px solid rgba(0, 0, 0, 0.1)',
      borderRight: '1px solid rgba(0, 0, 0, 0.1)',
      margin: '0',
      padding: '0',
      transition: 'height 0.5s',
    },
    bottomFrameInner: {
      width: '100%',
      padding: '16px 8px 0 8px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
    },
    headerContainer: {
      width: '100%',
      flex: 'none',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
    },
    dragHandleIcon: {
      width: '32px',
      height: '4px',
    },
    recommendedSizeContainer: {
      marginTop: '10px',
      marginBottom: '14px',
    },
    recommendedSizeText: {
      textTransform: 'uppercase',
      fontWeight: '600',
    },
    contentContainer: {
      flexGrow: 1,
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '0 16px 16px 16px',
      backgroundColor: '#FFFFFF',
      overflowY: 'auto',
    },
  }))

  useEffect(() => {
    function refreshBottomFrameStyle() {
      const bottomFrameInnerEl = bottomFrameInnerRef.current
      if (!bottomFrameInnerEl) {
        return
      }
      const parentEl = bottomFrameInnerEl.parentElement
      if (!parentEl) {
        return
      }
      const maxHeightPx = Number(window.getComputedStyle(parentEl).getPropertyValue('max-height').replace('px', ''))
      const heightPx = Math.min(bottomFrameInnerEl.clientHeight, maxHeightPx)
      const bottomFrameStyle: StyleProp = {
        height: `${heightPx}px`,
      }
      setBottomFrameOuterStyle(bottomFrameStyle)
      setBottomFrameInnerStyle(bottomFrameStyle)
    }
    setBottomFrameInnerStyle({})
    setTimeout(refreshBottomFrameStyle, 50)
  }, [contentView])

  let aboveContentNode: ReactNode = null
  if (contentView === 'expanded' || contentView === 'full') {
    aboveContentNode = <ProductSummaryRow loadedProductData={loadedProductData} />
  }

  let Content: React.FC<MobileContentProps>
  switch (contentView) {
    case 'collapsed':
      Content = MobileContentCollapsed
      break
    case 'expanded':
      Content = MobileContentExpanded
      break
    case 'full':
      Content = MobileContentFull
      break
  }

  return (
    <div css={css.mainContainer}>
      <Avatar frameUrls={frameUrls} setModalStyle={setModalStyle} />
      <button onClick={onClose} aria-label="Close modal" css={css.closeButton}>
        <CloseIcon css={css.closeIcon} />
      </button>
      <div css={css.bottomFrameOuter} style={bottomFrameOuterStyle}>
        <div ref={bottomFrameInnerRef} css={css.bottomFrameInner} style={bottomFrameInnerStyle}>
          <div css={css.headerContainer} onTouchStart={handleBottomFrameTouchStart}>
            <DragHandleIcon css={css.dragHandleIcon} />
            <div css={css.recommendedSizeContainer}>
              <RecommendedSizeText loadedProductData={loadedProductData} textCss={css.recommendedSizeText} />
            </div>
          </div>
          {aboveContentNode}
          <div css={css.contentContainer}>
            <Content
              loadedProductData={loadedProductData}
              selectedColorSizeRecord={selectedColorSizeRecord}
              availableColorLabels={availableColorLabels}
              selectedColorLabel={selectedColorLabel}
              selectedSizeLabel={selectedSizeLabel}
              onChangeContentView={setContentView}
              onChangeColor={onChangeColor}
              onChangeSize={onChangeSize}
              onAddToCart={onAddToCart}
              onSignOut={onSignOut}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

interface MobileContentProps {
  loadedProductData: VtoProductData
  selectedColorSizeRecord: VtoSizeColorData
  availableColorLabels: string[]
  selectedColorLabel: string | null
  selectedSizeLabel: string | null
  onChangeContentView: (contentView: MobileContentView) => void
  onChangeColor: (newColorLabel: string | null) => void
  onChangeSize: (newSizeLabel: string) => void
  onAddToCart: () => void
  onSignOut: () => void
}

function MobileContentCollapsed({
  loadedProductData,
  availableColorLabels,
  selectedColorLabel,
  selectedSizeLabel,
  onChangeColor,
  onChangeSize,
}: MobileContentProps) {
  const css = useCss((_theme) => ({
    selectSizeLabelContainer: {
      marginTop: '8px',
    },
    selectSizeLabelText: {},
    sizeSelectorContainer: {
      marginTop: '8px',
    },
    colorSelectorContainer: {
      marginTop: '8px',
    },
  }))
  return (
    <>
      <div css={css.selectSizeLabelContainer}>
        <TextT variant="base" css={css.selectSizeLabelText} t="size-rec.select_size" />
      </div>
      <div css={css.sizeSelectorContainer}>
        <SizeSelector
          loadedProductData={loadedProductData}
          selectedSizeLabel={selectedSizeLabel}
          onChangeSize={onChangeSize}
        />
      </div>
      <div css={css.colorSelectorContainer}>
        <ColorSelector
          availableColorLabels={availableColorLabels}
          selectedColorLabel={selectedColorLabel}
          onChangeColor={onChangeColor}
        />
      </div>
    </>
  )
}

function MobileContentExpanded({
  loadedProductData,
  availableColorLabels,
  selectedColorLabel,
  selectedSizeLabel,
  onChangeContentView,
  onChangeColor,
  onChangeSize,
  onAddToCart,
}: MobileContentProps) {
  const css = useCss((_theme) => ({
    selectSizeLabelContainer: {
      marginTop: '8px',
    },
    selectSizeLabelText: {},
    sizeSelectorContainer: {
      marginTop: '8px',
    },
    colorSelectorContainer: {
      marginTop: '8px',
    },
    itemFitTextContainer: {
      marginTop: '8px',
    },
    itemFitText: {},
    itemFitDetailsContainer: {
      marginTop: '8px',
      width: 'min(100%, 220px)',
    },
    buttonContainer: {
      marginTop: '24px',
      width: '100%',
      maxWidth: '375px',
    },
    productDetailsContainer: {
      marginTop: '24px',
      marginBottom: '16px',
    },
    productDetailsText: {
      textDecoration: 'underline',
      textTransform: 'uppercase',
      cursor: 'pointer',
    },
  }))

  const handleProductDetailsClick = useCallback(() => {
    onChangeContentView('full')
  }, [onChangeContentView])

  return (
    <>
      <div css={css.selectSizeLabelContainer}>
        <TextT variant="base" css={css.selectSizeLabelText} t="size-rec.select_size" />
      </div>
      <div css={css.sizeSelectorContainer}>
        <SizeSelector
          loadedProductData={loadedProductData}
          selectedSizeLabel={selectedSizeLabel}
          onChangeSize={onChangeSize}
        />
      </div>
      <div css={css.colorSelectorContainer}>
        <ColorSelector
          availableColorLabels={availableColorLabels}
          selectedColorLabel={selectedColorLabel}
          onChangeColor={onChangeColor}
        />
      </div>
      <div css={css.itemFitTextContainer}>
        <ItemFitText loadedProductData={loadedProductData} />
      </div>
      <div css={css.itemFitDetailsContainer}>
        <ItemFitDetails loadedProductData={loadedProductData} selectedSizeLabel={selectedSizeLabel} />
      </div>
      <div css={css.buttonContainer}>
        <AddToCartButton onClick={onAddToCart} />
        <FittingRoomToggleButton />
      </div>
      <div css={css.productDetailsContainer}>
        <LinkT
          variant="base"
          css={css.productDetailsText}
          t="quick-view.view_product_details"
          onClick={handleProductDetailsClick}
        />
      </div>
    </>
  )
}

function MobileContentFull({
  loadedProductData,
  selectedColorSizeRecord,
  availableColorLabels,
  selectedColorLabel,
  selectedSizeLabel,
  onChangeContentView,
  onChangeColor,
  onChangeSize,
  onAddToCart,
  onSignOut,
}: MobileContentProps) {
  const [fitChartOpen, setFitChartOpen] = useState<boolean>(false)
  const css = useCss((_theme) => ({
    sizeRecommendationFrame: {
      marginTop: '16px',
      width: 'min(100%, 375px)',
      display: 'flex',
      flexDirection: 'column',
      border: '1px solid rgba(33, 32, 31, 0.2)',
      padding: '16px',
      justifyContent: 'center',
      alignItems: 'center',
    },
    selectSizeLabelContainer: {},
    selectSizeLabelText: {},
    sizeSelectorContainer: {
      marginTop: '16px',
    },
    colorSelectorContainer: {
      marginTop: '16px',
    },
    itemFitTextContainer: {
      marginTop: '8px',
    },
    fitChartButton: {},
    itemFitText: {},
    itemFitDetailsContainer: {
      marginTop: '8px',
      width: 'min(100%, 220px)',
    },
    fitChartContainer: {
      marginTop: '16px',
    },
    buttonContainer: {
      marginTop: '16px',
      width: '100%',
      maxWidth: '375px',
    },
    productDetailsContainer: {
      marginTop: '24px',
      marginBottom: '16px',
    },
    productDetailsText: {
      textDecoration: 'underline',
      textTransform: 'uppercase',
      cursor: 'pointer',
    },
    priceContainer: {},
    priceText: {},
    productDescriptionContainer: {
      marginTop: '8px',
    },
    footerContainer: {
      marginTop: '48px',
    },
  }))

  const handleProductDetailsClick = useCallback(() => {
    onChangeContentView('expanded')
  }, [onChangeContentView])
  const handleFitChartOpen = useCallback(() => {
    setFitChartOpen(true)
  }, [])
  const handleFitChartClose = useCallback(() => {
    setFitChartOpen(false)
  }, [])

  let fitChartNode: ReactNode = null
  if (fitChartOpen) {
    fitChartNode = (
      <div css={css.fitChartContainer}>
        <FitChart onRequestClose={handleFitChartClose} />
      </div>
    )
  }

  return (
    <>
      <div css={css.sizeRecommendationFrame}>
        <div css={css.selectSizeLabelContainer}>
          <TextT variant="base" css={css.selectSizeLabelText} t="size-rec.select_size" />
        </div>
        <div css={css.sizeSelectorContainer}>
          <SizeSelector
            loadedProductData={loadedProductData}
            selectedSizeLabel={selectedSizeLabel}
            onChangeSize={onChangeSize}
          />
        </div>
        <div css={css.itemFitTextContainer}>
          <Button variant="base" css={css.fitChartButton} onClick={handleFitChartOpen}>
            <InfoIcon />
          </Button>
          <ItemFitText loadedProductData={loadedProductData} textCss={css.itemFitText} />
        </div>
        <div css={css.itemFitDetailsContainer}>
          <ItemFitDetails loadedProductData={loadedProductData} selectedSizeLabel={selectedSizeLabel} />
        </div>
      </div>
      {fitChartNode}
      <div css={css.colorSelectorContainer}>
        <ColorSelector
          availableColorLabels={availableColorLabels}
          selectedColorLabel={selectedColorLabel}
          onChangeColor={onChangeColor}
        />
      </div>
      <div css={css.buttonContainer}>
        <AddToCartButton onClick={onAddToCart} />
        <FittingRoomToggleButton />
      </div>
      <div css={css.productDetailsContainer}>
        <LinkT
          variant="base"
          css={css.productDetailsText}
          t="quick-view.hide_product_details"
          onClick={handleProductDetailsClick}
        />
      </div>
      <div css={css.priceContainer}>
        <Text variant="base" css={css.priceText}>
          {selectedColorSizeRecord.priceFormatted}
        </Text>
      </div>
      <div css={css.productDescriptionContainer}>
        <ProductDescriptionText loadedProductData={loadedProductData} />
      </div>
      <div css={css.footerContainer}>
        <Footer onSignOutClick={onSignOut} />
      </div>
    </>
  )
}

function DesktopLayout({
  loadedProductData,
  selectedColorSizeRecord,
  availableColorLabels,
  selectedColorLabel,
  selectedSizeLabel,
  frameUrls,
  setModalStyle,
  onClose,
  onChangeColor,
  onChangeSize,
  onAddToCart,
  onSignOut,
}: LayoutProps) {
  const { t } = useTranslation()
  const [fitChartOpen, setFitChartOpen] = useState<boolean>(false)
  const css = useCss((_theme) => ({
    mainContainer: {
      display: 'flex',
      height: '100%',
      position: 'relative',
      top: '-1px',
    },
    rightContainer: {
      flexGrow: 1,
      padding: '16px',
      display: 'flex',
      flexDirection: 'column',
    },
    contentContainer: {
      flexGrow: 1,
      display: 'flex',
      flexDirection: 'column',
      margin: '8px 0px',
      padding: '16px 48px',
      overflowY: 'auto',
    },
    productNameContainer: {},
    productNameText: {
      fontFamily: "'Inter', sans-serif",
      fontSize: '24px',
      fontWeight: 300,
    },
    priceContainer: {
      marginTop: '8px',
    },
    priceText: {
      fontSize: '18px',
    },
    colorContainer: {
      marginTop: '16px',
    },
    sizeRecommendationFrame: {
      marginTop: '16px',
      display: 'flex',
      flexDirection: 'column',
      border: '1px solid rgba(33, 32, 31, 0.2)',
      padding: '32px 56px',
      justifyContent: 'center',
      alignItems: 'center',
    },
    recommendedSizeContainer: {
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      lineHeight: 'normal',
    },
    recommendedSizeText: {
      fontWeight: '600',
    },
    fitChartButton: {},
    itemFitContainer: {
      marginTop: '8px',
      lineHeight: 'normal',
    },
    itemFitText: {
      fontFamily: "'Inter', sans-serif",
      fontWeight: 300,
    },
    selectSizeLabelContainer: {
      lineHeight: 'normal',
    },
    selectSizeLabelText: {
      fontFamily: "'Inter', sans-serif",
      fontWeight: 300,
    },
    sizeSelectorContainer: {
      marginTop: '24px',
    },
    itemFitDetailsContainer: {
      marginTop: '24px',
      width: '100%',
      // Cascades into <ItemFitDetails>; the bold recommended-size line above
      // and the size-selector buttons stay at their own weights.
      fontFamily: "'Inter', sans-serif",
      fontWeight: 300,
    },
    fitChartContainer: {
      marginTop: '16px',
    },
    buttonContainer: {
      marginTop: '24px',
    },
    descriptionContainer: {
      marginTop: '32px',
    },
  }))

  const handleFitChartOpen = useCallback(() => {
    setFitChartOpen(true)
  }, [])
  const handleFitChartClose = useCallback(() => {
    setFitChartOpen(false)
  }, [])

  let fitChartNode: ReactNode = null
  if (fitChartOpen) {
    fitChartNode = (
      <div css={css.fitChartContainer}>
        <FitChart onRequestClose={handleFitChartClose} />
      </div>
    )
  }

  return (
    <div css={css.mainContainer}>
      <Avatar frameUrls={frameUrls} setModalStyle={setModalStyle} />
      <div css={css.rightContainer}>
        <ModalTitlebar title={t('quick-view.title')} onCloseClick={onClose} />
        <div css={css.contentContainer}>
          <div css={css.productNameContainer}>
            <Text variant="brand" css={css.productNameText}>
              {loadedProductData.productName}
            </Text>
          </div>
          <div css={css.priceContainer}>
            <Text variant="base" css={css.priceText}>
              {selectedColorSizeRecord.priceFormatted}
            </Text>
          </div>
          <div css={css.colorContainer}>
            <ColorSelector
              availableColorLabels={availableColorLabels}
              selectedColorLabel={selectedColorLabel}
              onChangeColor={onChangeColor}
            />
          </div>
          <div css={css.sizeRecommendationFrame}>
            <div css={css.recommendedSizeContainer}>
              <Button variant="base" css={css.fitChartButton} onClick={handleFitChartOpen}>
                <InfoIcon />
              </Button>
              <RecommendedSizeText loadedProductData={loadedProductData} textCss={css.recommendedSizeText} />
            </div>
            <div css={css.itemFitContainer}>
              <ItemFitText loadedProductData={loadedProductData} textCss={css.itemFitText} />
            </div>
            <div css={css.selectSizeLabelContainer}>
              <TextT variant="base" css={css.selectSizeLabelText} t="size-rec.select_size" />
            </div>
            <div css={css.sizeSelectorContainer}>
              <SizeSelector
                loadedProductData={loadedProductData}
                selectedSizeLabel={selectedSizeLabel}
                onChangeSize={onChangeSize}
              />
            </div>
            <div css={css.itemFitDetailsContainer}>
              <ItemFitDetails loadedProductData={loadedProductData} selectedSizeLabel={selectedSizeLabel} />
            </div>
          </div>
          {fitChartNode}
          <div css={css.buttonContainer}>
            <AddToCartButton onClick={onAddToCart} />
            <FittingRoomToggleButton />
          </div>
          <div css={css.descriptionContainer}>
            <ProductDescriptionText loadedProductData={loadedProductData} />
          </div>
        </div>
        <Footer onSignOutClick={onSignOut} />
      </div>
    </div>
  )
}

interface AvatarLayoutData {
  topContainerStyle: StyleProp
  imageContainerStyle: StyleProp
  imageStyle: StyleProp
  bottomContainerStyle: StyleProp
}

interface AvatarProps {
  frameUrls: string[] | null
  setModalStyle: (style: StyleProp) => void
}

function Avatar({ frameUrls, setModalStyle }: AvatarProps) {
  const deviceLayout = useMainStore((state) => state.deviceLayout)
  const isMobileLayout = deviceLayout === DeviceLayout.MOBILE_PORTRAIT || deviceLayout === DeviceLayout.TABLET_PORTRAIT
  const [layoutData, setLayoutData] = useState<AvatarLayoutData>({
    topContainerStyle: {},
    imageContainerStyle: {},
    imageStyle: {},
    bottomContainerStyle: {},
  })
  const [selectedFrameIndex, setSelectedFrameIndex] = useState<number | null>(null)
  const [zoomOpen, setZoomOpen] = useState<boolean>(false)
  // Quick-view is a single-product VTO — only "add" is the initial load, so a
  // constant trigger fires the auto-rotate exactly once per Avatar mount and
  // never re-fires (size/color changes don't bump it).
  const cancelAutoRotate = useAutoRotate(1, frameUrls, selectedFrameIndex, setSelectedFrameIndex)
  const css = useCss((theme) => ({
    topContainer: {
      flex: 'none',
      height: '100%',
      // Positioning context for the zoom pill overlaid on the avatar.
      position: 'relative',
    },
    zoomPill: {
      position: 'absolute',
      // Bottom-right of the avatar image, 16px above the image's bottom edge.
      // When the rotation slider is on, that's also `clear of the gutter` —
      // when the slider is hidden, the gutter collapses to 0 and the 16px
      // offset alone keeps the pill inset from the image's true bottom.
      bottom: `${DESKTOP_AVATAR_GUTTER_HEIGHT_PX + 16}px`,
      right: '16px',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '8px',
      padding: '8px 16px',
      borderRadius: '24px',
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      border: `1px solid ${theme.color_fg_text}`,
      fontSize: '12px',
      fontWeight: '500',
      letterSpacing: '0.5px',
      textTransform: 'uppercase',
      cursor: 'pointer',
      // Rapid clicks on the rotation chevrons can otherwise spill a triple-
      // click selection into this label.
      userSelect: 'none',
      WebkitUserSelect: 'none',
      zIndex: 2,
    },
    zoomPillIcon: {
      width: '14px',
      height: '14px',
      flex: 'none',
    },
    bottomContainer: {
      position: 'absolute',
      bottom: '1px',
      height: '50px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      paddingBottom: '32px',
      backgroundColor: '#FFFFFF',
      backgroundImage: `url(${AVATAR_BOTTOM_BACKGROUND_URL})`,
      backgroundSize: 'contain',
      backgroundRepeat: 'repeat-y',
    },
    sliderInput: {
      width: '300px',
      accentColor: theme.color_tfr_800,
    },
    sliderText: {
      color: '#303030',
    },
  }))

  // Determine layout sizes on mount and resize
  useEffect(() => {
    function refreshLayoutData() {
      let imageSize: ElementSize
      let bottomContainerStyle: StyleProp
      let modalStyle: StyleProp
      if (isMobileLayout) {
        const screenWidthPx = window.innerWidth
        const screenHeightPx = window.innerHeight
        let imageWidthPx = screenWidthPx
        let imageHeightPx = Math.floor(imageWidthPx / AVATAR_IMAGE_ASPECT_RATIO)
        let bottomContainerHeightPx = screenHeightPx - imageHeightPx
        let modalWidthPx: number | null = null
        if (bottomContainerHeightPx < AVATAR_GUTTER_HEIGHT_PX) {
          bottomContainerHeightPx = AVATAR_GUTTER_HEIGHT_PX
          imageHeightPx = screenHeightPx - bottomContainerHeightPx
          imageWidthPx = Math.floor(imageHeightPx * AVATAR_IMAGE_ASPECT_RATIO)
          modalWidthPx = imageWidthPx
        }
        imageSize = {
          width: imageWidthPx,
          height: imageHeightPx,
        }
        bottomContainerStyle = {
          width: imageWidthPx,
          height: bottomContainerHeightPx,
        }
        if (modalWidthPx != null) {
          const theme = getThemeData()
          modalStyle = {
            width: modalWidthPx + 'px',
            left: '50%',
            transform: 'translateX(-50%)',
            borderTopColor: theme.color_tfr_800,
            borderTopStyle: 'solid',
            borderTopWidth: '1px',
            borderRightColor: theme.color_tfr_800,
            borderRightStyle: 'solid',
            borderRightWidth: '1px',
            borderLeftColor: theme.color_tfr_800,
            borderLeftStyle: 'solid',
            borderLeftWidth: '1px',
          }
        } else {
          modalStyle = {}
        }
      } else {
        const screenHeightPx = window.innerHeight
        const bottomContainerHeightPx = DESKTOP_AVATAR_GUTTER_HEIGHT_PX
        const imageHeightPx = screenHeightPx - bottomContainerHeightPx
        const imageWidthPx = Math.floor(imageHeightPx * AVATAR_IMAGE_ASPECT_RATIO)
        const modalWidthPx = imageWidthPx + CONTENT_AREA_WIDTH_PX
        imageSize = {
          width: imageWidthPx,
          height: imageHeightPx,
        }
        bottomContainerStyle = {
          width: imageWidthPx,
          height: bottomContainerHeightPx,
        }
        modalStyle = {
          width: `min(${modalWidthPx}px, 100vw)`,
        }
      }
      const topContainerStyle: StyleProp = {
        width: imageSize.width + 'px',
      }
      const imageContainerStyle: StyleProp = {
        width: imageSize.width + 'px',
        height: imageSize.height + 'px',
      }
      const imageStyle: StyleProp = {
        width: imageSize.width + 'px',
        height: imageSize.height + 'px',
      }
      setLayoutData({ topContainerStyle, imageContainerStyle, imageStyle, bottomContainerStyle })
      setModalStyle(modalStyle)
    }

    refreshLayoutData()
    window.addEventListener('resize', refreshLayoutData)

    return () => {
      window.removeEventListener('resize', refreshLayoutData)
    }
  }, [isMobileLayout, setModalStyle])

  // RENDERING:

  const isReady = !!frameUrls && selectedFrameIndex != null
  return (
    <div css={css.topContainer} style={layoutData.topContainerStyle}>
      <AvatarFrameViewer
        frameUrls={frameUrls}
        selectedFrameIndex={selectedFrameIndex}
        setSelectedFrameIndex={setSelectedFrameIndex}
        imageContainerStyle={layoutData.imageContainerStyle}
        imageStyle={layoutData.imageStyle}
        loadingT="quick-view.avatar_loading"
        onUserInteract={cancelAutoRotate}
      />
      {isReady && !isMobileLayout ? (
        <Button variant="base" css={css.zoomPill} onClick={() => setZoomOpen(true)}>
          <ZoomIcon css={css.zoomPillIcon} />
          <TextT variant="base" t="quick-view.zoom_in" />
        </Button>
      ) : null}
      {zoomOpen && frameUrls && frameUrls.length > 0 ? (
        <ZoomModal
          frameUrls={frameUrls}
          selectedFrameIndex={selectedFrameIndex}
          setSelectedFrameIndex={setSelectedFrameIndex}
          onClose={() => setZoomOpen(false)}
        />
      ) : null}
      {frameUrls && selectedFrameIndex != null && (isMobileLayout || SHOW_ROTATION_SLIDER) ? (
        <div css={css.bottomContainer} style={layoutData.bottomContainerStyle}>
          {isMobileLayout ? (
            <>&nbsp;</>
          ) : (
            <>
              <input
                type="range"
                min={0}
                max={frameUrls.length - 1}
                step={1}
                value={selectedFrameIndex}
                onChange={(e) => setSelectedFrameIndex(Number(e.target.value))}
                css={css.sliderInput}
              />
              <TextT variant="base" t="quick-view.slide_to_rotate" css={css.sliderText} />
            </>
          )}
        </div>
      ) : null}
    </div>
  )
}

interface ProductSummaryRowProps {
  loadedProductData: VtoProductData
}

function ProductSummaryRow({ loadedProductData }: ProductSummaryRowProps) {
  const css = useCss((_theme) => ({
    container: {
      width: '100%',
      padding: '4px 16px',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      backgroundColor: '#F8F8F8',
    },
    labelContainer: {},
    labelText: {
      fontFamily: "'Times New Roman', serif",
      fontSize: '16px',
      color: '#1A1A1A',
    },
    nameContainer: {},
    nameText: {
      fontFamily: "'Times New Roman', serif",
      fontSize: '16px',
      color: '#9F9F9F',
    },
  }))
  return (
    <div css={css.container}>
      <div css={css.labelContainer}>
        <Text variant="brand" css={css.labelText}>
          {loadedProductData.styleCategoryLabel}
        </Text>
      </div>
      <div css={css.nameContainer}>
        <Text variant="brand" css={css.nameText}>
          {loadedProductData.productName}
        </Text>
      </div>
    </div>
  )
}

interface RecommendedSizeTextProps {
  loadedProductData: VtoProductData
  textCss: CssProp
}

function RecommendedSizeText({ loadedProductData, textCss }: RecommendedSizeTextProps) {
  return (
    <TextT
      variant="base"
      css={textCss}
      t="size-rec.recommended_size"
      vars={{ size: loadedProductData.recommendedSizeLabel }}
    />
  )
}

interface ProductDescriptionTextProps {
  loadedProductData: VtoProductData
}

function ProductDescriptionText({ loadedProductData }: ProductDescriptionTextProps) {
  const css = useCss((_theme) => ({
    descriptionText: {
      fontSize: '12px',
    },
  }))
  return (
    <Text variant="base" css={css.descriptionText}>
      <span dangerouslySetInnerHTML={{ __html: loadedProductData.productDescriptionHtml }} />
    </Text>
  )
}

interface FooterProps {
  onSignOutClick: () => void
}

function Footer({ onSignOutClick }: FooterProps) {
  const css = useCss((theme) => ({
    container: {
      marginLeft: 'auto',
      marginRight: 'auto',
      paddingBottom: '16px',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      gap: '4px',
    },
    signOutLink: {
      fontSize: '10px',
      color: theme.color_tfr_800,
    },
    tfrIcon: {
      width: '100px',
      height: '24px',
    },
  }))

  return (
    <div css={css.container}>
      <LinkT variant="underline" css={css.signOutLink} onClick={onSignOutClick} t="quick-view.sign_out" />
      <TfrNameSvg css={css.tfrIcon} />
    </div>
  )
}
