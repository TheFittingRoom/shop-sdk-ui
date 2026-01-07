import { useCallback, useEffect, useMemo, useRef, useState, ReactNode } from 'react'
import { Button, ButtonT } from '@/components/button'
import { Loading } from '@/components/content/loading'
import { ModalTitlebar, SidecarModalFrame } from '@/components/modal'
import { LinkT } from '@/components/link'
import { Text, TextT } from '@/components/text'
import { getSizeRecommendation, getSizeLabelFromSize, requestVtoSingle, FitClassification, SizeFit } from '@/lib/api'
import {
  AVATAR_BOTTOM_BACKGROUND_URL,
  CheckCircleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  InfoIcon,
  TfrNameSvg,
} from '@/lib/asset'
import { getStyleByExternalId } from '@/lib/database'
import { getAuthManager } from '@/lib/firebase'
import { useTranslation } from '@/lib/locale'
import { getLogger } from '@/lib/logger'
import { getStaticData, useMainStore } from '@/lib/store'
import { useCss, CssProperties } from '@/lib/theme'
import { OverlayName } from '@/lib/view'

interface LoadedSizeColorData {
  colorwaySizeAssetId: number
  colorLabel: string
  sku: string
  priceFormatted: string
}

interface LoadedSizeData {
  sizeId: number
  sizeLabel: string
  isRecommended: boolean
  fit: SizeFit
  colors: LoadedSizeColorData[]
}

interface LoadedProductData {
  productName: string
  productDescriptionHtml: string
  fitClassification: FitClassification
  recommendedSizeId: number
  recommendedSizeLabel: string
  sizes: LoadedSizeData[]
}

interface ElementSize {
  width: number
  height: number
}

const logger = getLogger('vto-single')

export default function VtoSingleOverlay() {
  const { brandId } = getStaticData()
  const userIsLoggedIn = useMainStore((state) => state.userIsLoggedIn)
  const userHasAvatar = useMainStore((state) => state.userHasAvatar)
  const userProfile = useMainStore((state) => state.userProfile)
  const openOverlay = useMainStore((state) => state.openOverlay)
  const closeOverlay = useMainStore((state) => state.closeOverlay)
  const [loadedProductData, setLoadedProductData] = useState<LoadedProductData | null>(null)
  const [selectedSizeLabel, setSelectedSizeLabel] = useState<string | null>(null)
  const [selectedColorLabel, setSelectedColorLabel] = useState<string | null>(null)

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

  // Load initial data
  useEffect(() => {
    async function fetchInitialData() {
      try {
        const { currentProduct } = getStaticData()

        // Get external product data and user selections
        const { productName, productDescriptionHtml, variants } = currentProduct
        const { color: selectedColor } = await currentProduct.getSelectedOptions()

        // Fetch style and size recommendation
        const styleRec = await getStyleByExternalId(brandId, currentProduct.externalId)
        if (!styleRec) {
          logger.logError('Style not found for externalId:', currentProduct.externalId)
          return
        }
        const sizeRecommendationRecord = await getSizeRecommendation(styleRec.id)

        // Assemble loaded product data
        let productData: LoadedProductData
        const recommendedSizeLabel = getSizeLabelFromSize(sizeRecommendationRecord.recommended_size) ?? '(unknown)'
        {
          const fitClassification = sizeRecommendationRecord.fit_classification
          const recommendedSizeId = sizeRecommendationRecord.recommended_size.id
          const sizes: LoadedSizeData[] = []
          for (const sizeRec of sizeRecommendationRecord.available_sizes) {
            const sizeId = sizeRec.id
            const sizeLabel = getSizeLabelFromSize(sizeRec) ?? '(unknown)'
            const isRecommended = sizeRec.id === recommendedSizeId
            const fit = sizeRecommendationRecord.fits.find((f) => f.size_id === sizeRec.id)
            if (!fit) {
              continue
            }
            const colors: LoadedSizeColorData[] = []
            for (const csaRec of sizeRec.colorway_size_assets) {
              const colorwaySizeAssetId = csaRec.id
              const sku = csaRec.sku
              const variant = variants.find((v) => v.sku === sku)
              if (!variant) {
                continue
              }
              const colorLabel = variant.color
              const priceFormatted = variant.priceFormatted
              colors.push({
                colorwaySizeAssetId,
                colorLabel,
                sku,
                priceFormatted,
              })
            }
            sizes.push({
              sizeId,
              sizeLabel,
              isRecommended,
              fit,
              colors,
            })
          }
          productData = {
            productName,
            productDescriptionHtml,
            fitClassification,
            recommendedSizeId,
            recommendedSizeLabel,
            sizes,
          }
        }
        let recommendedColorLabel: string
        {
          const recommendedSizeRecord = productData.sizes.find((s) => s.isRecommended)!
          const recommendedSizeColorRecord =
            recommendedSizeRecord.colors.find((c) => {
              return c.colorLabel === selectedColor
            }) || recommendedSizeRecord.colors[0]

          recommendedColorLabel = recommendedSizeColorRecord.colorLabel
        }
        setLoadedProductData(productData)
        setSelectedSizeLabel(recommendedSizeLabel)
        setSelectedColorLabel(recommendedColorLabel)
      } catch (error) {
        logger.logError('Error fetching VTO data:', error)
      }
    }
    if (userIsLoggedIn && userHasAvatar) {
      fetchInitialData()
    }
  }, [userIsLoggedIn, userHasAvatar])

  // Derive selected color/size data from selections
  const { sizeColorRecord: selectedColorSizeRecord, availableColorLabels } = useMemo(() => {
    if (!loadedProductData) {
      return { sizeColorRecord: null, availableColorLabels: [] }
    }
    const sizeRecord = loadedProductData.sizes.find((s) => s.sizeLabel === selectedSizeLabel)
    if (!sizeRecord) {
      return { sizeColorRecord: null, availableColorLabels: [] }
    }
    const sizeColorRecord = sizeRecord.colors.find((c) => c.colorLabel === selectedColorLabel) ?? sizeRecord.colors[0]
    const availableColorLabels = sizeRecord.colors.map((c) => c.colorLabel)
    return { sizeColorRecord, availableColorLabels }
  }, [loadedProductData, selectedSizeLabel, selectedColorLabel])

  // Trigger priority VTO request when size/color selection changes
  useEffect(() => {
    if (selectedColorSizeRecord) {
      requestVtoSingle(selectedColorSizeRecord.colorwaySizeAssetId)
    }
  }, [selectedColorSizeRecord])

  // Trigger VTO requests for all recommended sizes when color selection changes
  useEffect(() => {
    if (!loadedProductData) {
      return
    }
    for (const sizeRecord of loadedProductData.sizes) {
      const sizeColorRecord = sizeRecord.colors.find((c) => c.colorLabel === selectedColorLabel) ?? sizeRecord.colors[0]
      requestVtoSingle(sizeColorRecord.colorwaySizeAssetId)
    }
  }, [loadedProductData, selectedColorLabel])

  // Lookup VTO frames when user profile changes
  const vtoData = useMemo(() => {
    if (!userProfile || !selectedColorSizeRecord) {
      return null
    }

    // Lookup VTO data from user profile
    const vtoData = userProfile.vto?.[brandId]?.[selectedColorSizeRecord.sku]
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

    return vtoData
  }, [selectedColorSizeRecord, userProfile])
  const frameUrls = vtoData?.frames ?? null

  const handleSignOutClick = useCallback(() => {
    closeOverlay()
    const authManager = getAuthManager()
    authManager.logout().catch((error) => {
      logger.logError('Error during logout:', error)
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
      logger.logError('Error adding to cart:', error)
    }
  }, [selectedColorLabel, selectedSizeLabel])

  // RENDERING:

  if (!userIsLoggedIn || !userHasAvatar || !loadedProductData || !selectedColorSizeRecord) {
    return (
      <SidecarModalFrame onRequestClose={closeOverlay}>
        <Loading />
      </SidecarModalFrame>
    )
  }

  return <SidecarModalFrame onRequestClose={closeOverlay}>
    <DesktopLayout
      loadedProductData={loadedProductData}
      selectedColorSizeRecord={selectedColorSizeRecord}
      availableColorLabels={availableColorLabels}
      selectedColorLabel={selectedColorLabel}
      selectedSizeLabel={selectedSizeLabel}
      frameUrls={frameUrls}
      onClose={closeOverlay}
      onChangeColor={setSelectedColorLabel}
      onChangeSize={setSelectedSizeLabel}
      onAddToCart={handleAddToCartClick}
      onSignOut={handleSignOutClick}
    />
  </SidecarModalFrame>
}

interface DesktopLayoutProps {
  loadedProductData: LoadedProductData
  selectedColorSizeRecord: LoadedSizeColorData
  availableColorLabels: string[]
  selectedColorLabel: string | null
  selectedSizeLabel: string | null
  frameUrls: string[] | null
  onClose: () => void
  onChangeColor: (newColorLabel: string | null) => void
  onChangeSize: (newSizeLabel: string) => void
  onAddToCart: () => void
  onSignOut: () => void
}

function DesktopLayout({
  loadedProductData,
  selectedColorSizeRecord,
  availableColorLabels,
  selectedColorLabel,
  selectedSizeLabel,
  frameUrls,
  onClose,
  onChangeColor,
  onChangeSize,
  onAddToCart,
  onSignOut,
}: DesktopLayoutProps) {
  const { t } = useTranslation()
  const css = useCss((_theme) => ({
    mainContainer: {
      display: 'flex',
      height: '100%',
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
    sizeRecommendationContainer: {
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
    buttonContainer: {
      marginTop: '24px',
    },
    descriptionContainer: {
      marginTop: '32px',
    },
  }))
  return (
    <div css={css.mainContainer}>
      <Avatar frameUrls={frameUrls} />
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
          <div css={css.sizeRecommendationContainer}>
            <div css={css.recommendedSizeContainer}>
              <InfoIcon />
              <RecommendedSizeText loadedProductData={loadedProductData} css={css.recommendedSizeText} />
            </div>
            <div css={css.itemFitContainer}>
              <ItemFitText loadedProductData={loadedProductData} css={css.itemFitText} />
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

interface AvatarProps {
  frameUrls: string[] | null
}

const AVATAR_DESKTOP_BOTTOM_CONTAINER_HEIGHT_PX = 100

function Avatar({ frameUrls }: AvatarProps) {
  const [containerSize, setContainerSize] = useState<ElementSize>({
    width: window.innerWidth,
    height: window.innerHeight,
  })
  const topContainerRef = useRef<HTMLDivElement>(null)
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
      bottom: '0',
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

  // Determine container height on mount and resize
  useEffect(() => {
    const handleResize = () => {
      const containerEl = topContainerRef.current
      const size: ElementSize = containerEl
        ? {
            width: containerEl.clientWidth,
            height: containerEl.clientHeight,
          }
        : {
            width: window.innerWidth,
            height: window.innerHeight,
          }
      setContainerSize(size)
    }
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [])

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
      }, 200)
    }
  }, [frameUrls, selectedFrameIndex])

  // Determmine element dimensions based on container size
  const { imageSize, bottomContainerSize } = useMemo(() => {
    let imageSize: ElementSize
    let bottomContainerSize: ElementSize

    const imageHeightPx = containerSize.height - AVATAR_DESKTOP_BOTTOM_CONTAINER_HEIGHT_PX
    const imageWidthPx = Math.floor(imageHeightPx / 1.5)
    const bottomContainerHeightPx = AVATAR_DESKTOP_BOTTOM_CONTAINER_HEIGHT_PX
    imageSize = { width: imageWidthPx, height: imageHeightPx }
    bottomContainerSize = { width: imageWidthPx, height: bottomContainerHeightPx }

    return { imageSize, bottomContainerSize }
  }, [containerSize])

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
  const handleImageDrag = useCallback(
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

  // RENDERING:

  let contentNode: ReactNode
  if (frameUrls && selectedFrameIndex != null) {
    contentNode = (
      <>
        <div css={css.imageContainer} style={{ width: imageSize.width + 'px', height: imageSize.height + 'px' }}>
          <img
            src={frameUrls[selectedFrameIndex]}
            css={css.image}
            style={{ width: imageSize.width + 'px', height: imageSize.height + 'px' }}
            onMouseDown={handleImageDrag}
          />
          <div css={css.chevronLeftContainer} onClick={rotateLeft}>
            <ChevronLeftIcon css={css.chevronIcon} />
          </div>
          <div css={css.chevronRightContainer} onClick={rotateRight}>
            <ChevronRightIcon css={css.chevronIcon} />
          </div>
        </div>
        <div
          css={css.bottomContainer}
          style={{ width: bottomContainerSize.width + 'px', height: bottomContainerSize.height + 'px' }}
        >
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
        </div>
      </>
    )
  } else {
    contentNode = <Loading t="vto-single.avatar_loading" />
  }
  return (
    <div ref={topContainerRef} css={css.topContainer} style={{ width: imageSize.width + 'px' }}>
      {contentNode}
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
  loadedProductData: LoadedProductData
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
  loadedProductData: LoadedProductData
  css?: CssProperties
}

function RecommendedSizeText({ loadedProductData, css }: RecommendedSizeTextProps) {
  return (
    <TextT
      variant="base"
      css={css}
      t="size-rec.recommended_size"
      vars={{ size: loadedProductData.recommendedSizeLabel }}
    />
  )
}

interface ItemFitTextProps {
  loadedProductData: LoadedProductData
  css?: CssProperties
}

function ItemFitText({ loadedProductData, css }: ItemFitTextProps) {
  const { t } = useTranslation()
  return (
    <TextT
      variant="base"
      css={css}
      t="size-rec.item_fit"
      vars={{
        fit:
          t(`size-rec.fitClassification.${loadedProductData.fitClassification}`) || loadedProductData.fitClassification,
      }}
    />
  )
}

interface ItemFitDetailsProps {
  loadedProductData: LoadedProductData
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
  loadedProductData: LoadedProductData
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
