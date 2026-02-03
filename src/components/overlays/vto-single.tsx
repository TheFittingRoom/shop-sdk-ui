import { useCallback, useEffect, useMemo, useRef, useState, ReactNode } from 'react'
import { Button, ButtonT } from '@/components/button'
import { FitChart } from '@/components/content/fit-chart'
import { Loading } from '@/components/content/loading'
import { ModalTitlebar, SidecarModalFrame } from '@/components/modal'
import { LinkT } from '@/components/link'
import { Text, TextT } from '@/components/text'
import {
  requestVtoSingle as apiRequestVtoSingle,
  FitClassification,
  SizeFit,
} from '@/lib/api'
import {
  AVATAR_BOTTOM_BACKGROUND_URL,
  CheckCircleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CloseIcon,
  DragHandleIcon,
  InfoIcon,
  TfrNameSvg,
} from '@/lib/asset'
import { getAuthManager } from '@/lib/firebase'
import { useTranslation } from '@/lib/locale'
import { getLogger } from '@/lib/logger'
import { loadProductDataToStore } from '@/lib/product'
import { getStaticData, useMainStore } from '@/lib/store'
import { getThemeData, useCss, CssProp, StyleProp } from '@/lib/theme'
import { getSizeLabelFromSize } from '@/lib/util'
import { DeviceLayout, OverlayName } from '@/lib/view'

interface VtoSizeColorData {
  colorwaySizeAssetId: number
  colorLabel: string | null
  sku: string
  priceFormatted: string
}

interface VtoSizeData {
  sizeId: number
  sizeLabel: string
  isRecommended: boolean
  fit: SizeFit
  colors: VtoSizeColorData[]
}

interface VtoProductData {
  productName: string
  productDescriptionHtml: string
  fitClassification: FitClassification
  recommendedSizeId: number
  recommendedSizeLabel: string
  sizes: VtoSizeData[]
  styleCategoryLabel: string | null
}

interface ElementSize {
  width: number
  height: number
}

const NON_PRIORITY_VTO_REQUEST_DELAY_MS: number | false = 500
const AVATAR_IMAGE_ASPECT_RATIO = 2 / 3 // width:height
const AVATAR_GUTTER_HEIGHT_PX = 100
const CONTENT_AREA_WIDTH_PX = 550

const logger = getLogger('overlays/vto-single')

export default function VtoSingleOverlay() {
  const userIsLoggedIn = useMainStore((state) => state.userIsLoggedIn)
  const userHasAvatar = useMainStore((state) => state.userHasAvatar)
  const userProfile = useMainStore((state) => state.userProfile)
  const storeProductData = useMainStore((state) => state.productData)
  const deviceLayout = useMainStore((state) => state.deviceLayout)
  const openOverlay = useMainStore((state) => state.openOverlay)
  const closeOverlay = useMainStore((state) => state.closeOverlay)
  const [vtoProductData, setVtoProductData] = useState<VtoProductData | false | null>(null)
  const [selectedSizeLabel, setSelectedSizeLabel] = useState<string | null>(null)
  const [selectedColorLabel, setSelectedColorLabel] = useState<string | null>(null)
  const [modalStyle, setModalStyle] = useState<StyleProp>({})
  const fetchedVtoSkus = useRef<Set<string>>(new Set())
  const readyVtoSkus = useRef<Set<string>>(new Set())
  const lastPriorityVtoRequestTimeRef = useRef<number | null>(null)

  // Redirect if not logged in or no avatar
  useEffect(() => {
    if (!userIsLoggedIn) {
      openOverlay(OverlayName.LANDING, { returnToOverlay: OverlayName.VTO_SINGLE })
      return
    }
    if (userIsLoggedIn && userHasAvatar === false) {
      openOverlay(OverlayName.GET_APP, { returnToOverlay: OverlayName.VTO_SINGLE, noAvatar: true })
      return
    }
  }, [userIsLoggedIn, userHasAvatar, openOverlay])

  // On load, load store product data (in case not already loaded)
  useEffect(() => {
    const { currentProduct } = getStaticData()
    loadProductDataToStore(currentProduct.externalId)
  }, [])

  // On load, generate vto product data from store product data + user selections
  useEffect(() => {
    async function setupInitialVtoData() {
      try {
        const { brandId, currentProduct } = getStaticData()
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

        // Assemble vto product data
        const styleGarmentCategoryRec = storeProduct.styleGarmentCategory
        const styleCategoryLabel = styleGarmentCategoryRec?.style_category_label ?? null
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

        // Mark already available VTO SKUs as fetched/ready
        for (const sku in userProfile?.vto?.[brandId] ?? {}) {
          fetchedVtoSkus.current.add(sku)
          readyVtoSkus.current.add(sku)
        }
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
    setupInitialVtoData()
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

  // Fetch VTO data for a color/size
  const requestVto = useCallback((sizeColorRecord: VtoSizeColorData, priority: boolean) => {
    if (fetchedVtoSkus.current.has(sizeColorRecord.sku)) {
      return
    }
    function executeRequest() {
      logger.timerStart(`requestVto_${sizeColorRecord.sku}`)
      logger.logDebug(`{{ts}} - Requesting VTO for sku: ${sizeColorRecord.sku}`, { priority, sizeColorRecord })
      fetchedVtoSkus.current.add(sizeColorRecord.sku)

      apiRequestVtoSingle(sizeColorRecord.colorwaySizeAssetId).catch((error) => {
        logger.logError(`Error requesting VTO for sku: ${sizeColorRecord.sku}`, { error, sizeColorRecord })
      })
    }
    if (NON_PRIORITY_VTO_REQUEST_DELAY_MS) {
      let delay: number = 0
      if (priority) {
        lastPriorityVtoRequestTimeRef.current = Date.now()
      } else {
        const lastPriorityTime = lastPriorityVtoRequestTimeRef.current
        if (lastPriorityTime) {
          const now = Date.now()
          const minNextRequestTime = lastPriorityTime + NON_PRIORITY_VTO_REQUEST_DELAY_MS
          if (now < minNextRequestTime) {
            delay = minNextRequestTime - now
          }
        }
      }
      if (delay) {
        setTimeout(executeRequest, delay)
        return
      }
    }
    executeRequest()
  }, [])

  // Trigger priority VTO request when size/color selection changes
  useEffect(() => {
    if (selectedColorSizeRecord) {
      requestVto(selectedColorSizeRecord, true)
    }
  }, [requestVto, selectedColorSizeRecord])

  // Trigger VTO requests for all recommended sizes when color selection changes (and on initial load)
  useEffect(() => {
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

  // Lookup VTO frames for selected color/size from user profile
  const vtoData = useMemo(() => {
    if (!userProfile || !selectedColorSizeRecord) {
      return null
    }

    // Lookup VTO data from user profile
    const { brandId } = getStaticData()
    const availableSkuData = userProfile.vto?.[brandId]
    if (!availableSkuData) {
      return null
    }

    // Track VTO performance
    if (logger.isDebugEnabled()) {
      for (const sku of fetchedVtoSkus.current) {
        if (!readyVtoSkus.current.has(sku) && availableSkuData[sku]) {
          readyVtoSkus.current.add(sku)
          logger.timerEnd(`requestVto_${sku}`)
          logger.logTimer(`requestVto_${sku}`, `{{ts}} - VTO data is loaded for sku: ${sku}`)
        }
      }
    }

    // Lookup selected SKU (color/size) VTO data
    const vtoData = availableSkuData[selectedColorSizeRecord.sku]
    if (!vtoData) {
      return null
    }

    // Preload frame images
    if (vtoData.frames) {
      vtoData.frames.forEach((frameUrl) => {
        const img = new Image()
        img.src = frameUrl
      })
    }

    logger.logDebug(`{{ts}} - Displaying VTO for sku: ${selectedColorSizeRecord.sku}`)
    return vtoData
  }, [selectedColorSizeRecord, userProfile])
  const frameUrls = vtoData?.frames ?? null

  const handleSignOutClick = useCallback(() => {
    closeOverlay()
    const authManager = getAuthManager()
    authManager.logout().catch((error) => {
      logger.logError('Error during logout:', { error })
    })
  }, [closeOverlay, openOverlay])
  const handleAddToCartClick = useCallback(async () => {
    try {
      if (!selectedSizeLabel) {
        return
      }
      const { currentProduct } = getStaticData()

      closeOverlay()
      await currentProduct.addToCart({ size: selectedSizeLabel, color: selectedColorLabel })
    } catch (error) {
      logger.logError('Error adding to cart:', { error })
    }
  }, [selectedColorLabel, selectedSizeLabel])

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
        onChangeColor={setSelectedColorLabel}
        onChangeSize={setSelectedSizeLabel}
        onAddToCart={handleAddToCartClick}
        onSignOut={handleSignOutClick}
      />
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
        <ModalTitlebar title={t('try_it_on')} onCloseClick={onClose} />
      </div>
      <div css={css.contentContainer}>
        <div>&nbsp;</div>
        <div css={css.messageContainer}>
          <TextT variant="base" t="vto-single.no_recommendation" />
        </div>
        <div css={css.footerContainer}>
          <Footer onSignOutClick={onSignOut} />
        </div>
      </div>
    </div>
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
  const [contentView, setContentView] = useState<MobileContentView>('collapsed')
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
      const maxHeightPx = Number(
        window.getComputedStyle(bottomFrameInnerEl.parentElement!).getPropertyValue('max-height').replace('px', ''),
      )
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

  const handleBottomFrameTouchStart = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      let startY = e.touches[0].clientY
      const initialContentView = contentView
      const onTouchMove = (moveEvent: TouchEvent) => {
        const deltaY = moveEvent.touches[0].clientY - startY
        if (Math.abs(deltaY) >= 30) {
          if (deltaY > 0) {
            // Swiping down
            if (initialContentView === 'full' || initialContentView === 'expanded') {
              setContentView('collapsed')
            }
          } else {
            // Swiping up
            if (initialContentView === 'collapsed') {
              setContentView('expanded')
            } else if (initialContentView === 'expanded') {
              setContentView('full')
            }
          }
          document.removeEventListener('touchmove', onTouchMove)
        }
      }
      document.addEventListener('touchmove', onTouchMove)
      const onTouchEnd = () => {
        document.removeEventListener('touchmove', onTouchMove)
        document.removeEventListener('touchend', onTouchEnd)
      }
      document.addEventListener('touchend', onTouchEnd)
    },
    [contentView],
  )

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

function MobileContentCollapsed({ loadedProductData, selectedSizeLabel, onChangeSize }: MobileContentProps) {
  const css = useCss((_theme) => ({
    selectSizeLabelContainer: {
      marginTop: '8px',
    },
    selectSizeLabelText: {},
    sizeSelectorContainer: {
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
    </>
  )
}

function MobileContentExpanded({
  loadedProductData,
  selectedSizeLabel,
  onChangeContentView,
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
      <div css={css.itemFitTextContainer}>
        <ItemFitText loadedProductData={loadedProductData} />
      </div>
      <div css={css.itemFitDetailsContainer}>
        <ItemFitDetails loadedProductData={loadedProductData} selectedSizeLabel={selectedSizeLabel} />
      </div>
      <div css={css.buttonContainer}>
        <AddToCartButton onClick={onAddToCart} />
      </div>
      <div css={css.productDetailsContainer}>
        <LinkT
          variant="base"
          css={css.productDetailsText}
          t="vto-single.view_product_details"
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
      </div>
      <div css={css.productDetailsContainer}>
        <LinkT
          variant="base"
          css={css.productDetailsText}
          t="vto-single.hide_product_details"
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
      fontSize: '32px',
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
    itemFitText: {},
    selectSizeLabelContainer: {
      lineHeight: 'normal',
    },
    selectSizeLabelText: {},
    sizeSelectorContainer: {
      marginTop: '24px',
    },
    itemFitDetailsContainer: {
      marginTop: '24px',
      width: '100%',
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
        <ModalTitlebar title={t('try_it_on')} onCloseClick={onClose} />
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
  const css = useCss((theme) => ({
    topContainer: {
      flex: 'none',
      height: '100%',
    },
    imageContainer: {
      position: 'absolute',
    },
    image: {
      objectFit: 'contain',
      cursor: 'grab',
    },
    chevronLeftContainer: {
      position: 'absolute',
      top: '50%',
      left: '0',
      transform: 'translateY(-50%)',
      cursor: 'pointer',
    },
    chevronRightContainer: {
      position: 'absolute',
      top: '50%',
      right: '0',
      transform: 'translateY(-50%)',
      cursor: 'pointer',
    },
    chevronIcon: {
      width: '48px',
      height: '48px',
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
        const bottomContainerHeightPx = AVATAR_GUTTER_HEIGHT_PX
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
  }, [isMobileLayout])

  // Auto-rotate avatar on initial frame load
  useEffect(() => {
    if (frameUrls && frameUrls.length > 0 && selectedFrameIndex == null) {
      // let currentFrameIndex = Math.ceil(frameUrls.length / 2)
      let currentFrameIndex = 0
      setSelectedFrameIndex(currentFrameIndex)
      const intervalId = setInterval(() => {
        currentFrameIndex = (currentFrameIndex + 1) % frameUrls.length
        setSelectedFrameIndex(currentFrameIndex)
        if (currentFrameIndex === 0) {
          clearInterval(intervalId)
        }
      }, 500)
    }
  }, [frameUrls, selectedFrameIndex])

  const rotateLeft = useCallback(() => {
    setSelectedFrameIndex((prevIndex) => {
      if (prevIndex == null) {
        return null
      }
      return prevIndex === 0 ? (frameUrls ? frameUrls.length - 1 : 0) : prevIndex - 1
    })
  }, [frameUrls])
  const rotateRight = useCallback(() => {
    setSelectedFrameIndex((prevIndex) => {
      if (prevIndex == null) {
        return null
      }
      return prevIndex === (frameUrls ? frameUrls.length - 1 : 0) ? 0 : prevIndex + 1
    })
  }, [frameUrls])
  const handleImageMouseDrag = useCallback(
    (e: React.MouseEvent<HTMLImageElement, MouseEvent>) => {
      e.preventDefault()
      let startX = e.clientX

      const onMouseMove = (moveEvent: MouseEvent) => {
        const deltaX = moveEvent.clientX - startX
        if (Math.abs(deltaX) >= 50) {
          if (deltaX > 0) {
            rotateRight()
          } else {
            rotateLeft()
          }
          startX = moveEvent.clientX
        }
      }

      const onMouseUp = () => {
        window.removeEventListener('mousemove', onMouseMove)
        window.removeEventListener('mouseup', onMouseUp)
      }

      window.addEventListener('mousemove', onMouseMove)
      window.addEventListener('mouseup', onMouseUp)
    },
    [rotateLeft, rotateRight],
  )
  const handleImageTouchDrag = useCallback(
    (e: React.TouchEvent<HTMLImageElement>) => {
      e.preventDefault()
      let startX = e.touches[0].clientX

      const onTouchMove = (moveEvent: TouchEvent) => {
        const deltaX = moveEvent.touches[0].clientX - startX
        if (Math.abs(deltaX) >= 50) {
          if (deltaX > 0) {
            rotateRight()
          } else {
            rotateLeft()
          }
          startX = moveEvent.touches[0].clientX
        }
      }

      const onTouchEnd = () => {
        window.removeEventListener('touchmove', onTouchMove)
        window.removeEventListener('touchend', onTouchEnd)
      }

      window.addEventListener('touchmove', onTouchMove)
      window.addEventListener('touchend', onTouchEnd)
    },
    [rotateLeft, rotateRight],
  )

  // RENDERING:

  let contentNode: ReactNode
  if (frameUrls && selectedFrameIndex != null) {
    contentNode = (
      <>
        <div css={css.imageContainer} style={layoutData.imageContainerStyle}>
          <img
            src={frameUrls[selectedFrameIndex]}
            css={css.image}
            style={layoutData.imageStyle}
            onMouseDown={handleImageMouseDrag}
            onTouchStart={handleImageTouchDrag}
          />
          <div css={css.chevronLeftContainer} onClick={rotateLeft}>
            <ChevronLeftIcon css={css.chevronIcon} />
          </div>
          <div css={css.chevronRightContainer} onClick={rotateRight}>
            <ChevronRightIcon css={css.chevronIcon} />
          </div>
        </div>
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
              <TextT variant="base" t="vto-single.slide_to_rotate" css={css.sliderText} />
            </>
          )}
        </div>
      </>
    )
  } else {
    contentNode = <Loading t="vto-single.avatar_loading" />
  }
  return (
    <div css={css.topContainer} style={layoutData.topContainerStyle}>
      {contentNode}
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
      color: '#1A1A1A',
    },
    nameContainer: {},
    nameText: {
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

interface ColorSelectorProps {
  availableColorLabels: string[]
  selectedColorLabel: string | null
  onChangeColor: (newColorLabel: string | null) => void
}

function ColorSelector({ availableColorLabels, selectedColorLabel, onChangeColor }: ColorSelectorProps) {
  const css = useCss((theme) => ({
    colorContainer: {},
    colorLabelText: {
      fontSize: '12px',
    },
    colorSelect: {
      border: 'none',
      color: theme.color_fg_text,
      fontFamily: theme.font_family,
      fontSize: '12px',
    },
  }))

  const handleColorSelectChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const newColorLabel = e.target.value || null
    onChangeColor(newColorLabel)
  }, [])

  if (availableColorLabels.length < 2) {
    return null
  }
  return (
    <div css={css.colorContainer}>
      <label>
        <TextT variant="base" css={css.colorLabelText} t="vto-single.color_label" />
        <select value={selectedColorLabel ?? ''} onChange={handleColorSelectChange} css={css.colorSelect}>
          {availableColorLabels.map((colorLabel) => (
            <option key={colorLabel} value={colorLabel}>
              {colorLabel}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}

interface SizeSelectorProps {
  loadedProductData: VtoProductData
  selectedSizeLabel: string | null
  onChangeSize: (newSizeLabel: string) => void
}

function SizeSelector({ loadedProductData, selectedSizeLabel, onChangeSize }: SizeSelectorProps) {
  const css = useCss((_theme) => ({
    container: {
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
    },
    button: {
      width: '54px',
      height: '44px',
      border: '1px solid rgba(33, 32, 31, 0.2)',
      padding: '9px 5px',
    },
    selectedButton: {
      border: '1px solid rgb(33, 32, 31)',
      cursor: 'default',
    },
  }))
  const sizeSelectorNodeList = useMemo(
    () =>
      loadedProductData.sizes.map((sizeRecord) => {
        const isSelected = sizeRecord.sizeLabel === selectedSizeLabel
        return (
          <Button
            key={sizeRecord.sizeLabel}
            variant="base"
            css={{ ...css.button, ...(isSelected && css.selectedButton) }}
            onClick={() => {
              if (isSelected) {
                return
              }
              onChangeSize(sizeRecord.sizeLabel)
            }}
          >
            {sizeRecord.sizeLabel}
          </Button>
        )
      }),
    [loadedProductData.sizes, selectedSizeLabel, onChangeSize],
  )
  return <div css={css.container}>{sizeSelectorNodeList}</div>
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

interface ItemFitTextProps {
  loadedProductData: VtoProductData
  textCss?: CssProp
}

function ItemFitText({ loadedProductData, textCss }: ItemFitTextProps) {
  const { t } = useTranslation()
  return (
    <TextT
      variant="base"
      css={textCss}
      t="size-rec.item_fit"
      vars={{
        fit:
          t(`size-rec.fitClassification.${loadedProductData.fitClassification}`) || loadedProductData.fitClassification,
      }}
    />
  )
}

interface ItemFitDetailsProps {
  loadedProductData: VtoProductData
  selectedSizeLabel: string | null
}

function ItemFitDetails({ loadedProductData, selectedSizeLabel }: ItemFitDetailsProps) {
  const { t } = useTranslation()
  const css = useCss((_theme) => ({
    container: {
      width: '100%',
    },
    line: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: '8px',
      marginTop: '4px',
      borderTop: '1px solid rgb(33, 32, 31)',
      paddingTop: '4px',
    },
    firstLine: {
      borderTop: 'none',
      marginTop: '0px',
      paddingTop: '0px',
    },
    detailCell: {
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
    },
  }))
  const fitLineNodeList = useMemo(() => {
    const selectedSizeRecord = loadedProductData.sizes.find((s) => s.sizeLabel === selectedSizeLabel)
    if (!selectedSizeRecord) {
      return null
    }
    return selectedSizeRecord.fit.measurement_location_fits.map((mlf, index) => {
      const locationLabel = t(`size-rec.measurementLocation.${mlf.measurement_location}`) || mlf.measurement_location
      const fit = mlf.fit
      const fitLabel = t(`size-rec.fit.${fit}`) || fit
      return (
        <div key={index} css={[css.line, index === 0 && css.firstLine]}>
          <div css={css.detailCell}>{locationLabel}</div>
          <div css={css.detailCell}>
            {fit === 'perfect_fit' ? (
              <>
                <CheckCircleIcon /> {fitLabel}
              </>
            ) : (
              fitLabel
            )}
          </div>
        </div>
      )
    })
  }, [loadedProductData, selectedSizeLabel])

  return <div css={css.container}>{fitLineNodeList}</div>
}

interface AddToCartButtonProps {
  onClick: () => void
}

function AddToCartButton({ onClick }: AddToCartButtonProps) {
  return <ButtonT variant="brand" t="vto-single.add_to_cart" onClick={onClick} />
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
      <LinkT variant="underline" css={css.signOutLink} onClick={onSignOutClick} t="vto-single.sign_out" />
      <TfrNameSvg css={css.tfrIcon} />
    </div>
  )
}
