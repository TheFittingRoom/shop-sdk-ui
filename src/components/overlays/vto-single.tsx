import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button, ButtonT } from '@/components/button'
import { Loading } from '@/components/content/loading'
import { ModalTitlebar, SidecarModalFrame } from '@/components/modal'
import { LinkT } from '@/components/link'
import { Text, TextT } from '@/components/text'
import { getSizeRecommendation, getSizeLabelFromSize, requestVtoSingle, FitClassification, SizeFit } from '@/lib/api'
import { AvatarBottomBackgroundUrl, CheckCircleIcon, ChevronLeftIcon, ChevronRightIcon, InfoIcon, TfrNameSvg } from '@/lib/asset'
import { getStyleByExternalId } from '@/lib/database'
import { getAuthManager } from '@/lib/firebase'
import { useTranslation } from '@/lib/locale'
import { getLogger } from '@/lib/logger'
import { getStaticData, useMainStore } from '@/lib/store'
import { useCss } from '@/lib/theme'
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

const logger = getLogger('vto-single')

export default function VtoSingleOverlay() {
  const { t } = useTranslation()
  const { brandId } = getStaticData()
  const userIsLoggedIn = useMainStore((state) => state.userIsLoggedIn)
  const userHasAvatar = useMainStore((state) => state.userHasAvatar)
  const userProfile = useMainStore((state) => state.userProfile)
  const openOverlay = useMainStore((state) => state.openOverlay)
  const closeOverlay = useMainStore((state) => state.closeOverlay)
  const [loadedProductData, setLoadedProductData] = useState<LoadedProductData | null>(null)
  const [selectedSizeLabel, setSelectedSizeLabel] = useState<string | null>(null)
  const [selectedColorLabel, setSelectedColorLabel] = useState<string | null>(null)
  const css = useCss((theme) => ({
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
      padding: '16px 48px',
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
    colorLabelText: {
      fontSize: '12px',
    },
    colorSelect: {
      border: 'none',
      color: theme.color_fg_text,
      fontFamily: theme.font_family,
      fontSize: '12px',
    },
    sizeRecContainer: {
      marginTop: '16px',
    },
    buttonContainer: {
      marginTop: '24px',
    },
    descriptionContainer: {
      marginTop: '32px',
    },
    descriptionText: {
      fontSize: '12px',
    },
    footerContainer: {
      width: '50%',
      position: 'absolute',
      bottom: '16px',
      marginLeft: 'auto',
      marginRight: 'auto',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      gap: '4px',
    },
    footerSignOutLink: {
      fontSize: '10px',
      color: theme.color_tfr_800,
    },
    footerTfrIcon: {
      width: '100px',
      height: '24px',
    },
  }))

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
    fetchInitialData()
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
  const handleColorSelectChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const newColorLabel = e.target.value || null
    setSelectedColorLabel(newColorLabel)
  }, [])
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

  return (
    <SidecarModalFrame onRequestClose={closeOverlay}>
      <div css={css.mainContainer}>
        <VtoAvatar frameUrls={frameUrls} />
        <div css={css.rightContainer}>
          <ModalTitlebar title={t('try_it_on')} onCloseClick={closeOverlay} />
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
            {availableColorLabels.length >= 2 && (
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
            )}
            <div css={css.sizeRecContainer}>
              <SizeRecommendation
                loadedProductData={loadedProductData}
                selectedSizeLabel={selectedSizeLabel}
                onChangeSize={setSelectedSizeLabel}
              />
            </div>
            <div css={css.buttonContainer}>
              <ButtonT variant="brand" t="vto-single.add_to_cart" onClick={handleAddToCartClick} />
            </div>
            <div css={css.descriptionContainer}>
              <Text variant="base" css={css.descriptionText}>
                <span dangerouslySetInnerHTML={{ __html: loadedProductData.productDescriptionHtml }} />
              </Text>
            </div>
          </div>
          <div css={css.footerContainer}>
            <LinkT
              variant="underline"
              css={css.footerSignOutLink}
              onClick={handleSignOutClick}
              t="vto-single.sign_out"
            />
            <TfrNameSvg css={css.footerTfrIcon} />
          </div>
        </div>
      </div>
    </SidecarModalFrame>
  )
}

interface VtoAvatarProps {
  frameUrls: string[] | null
}

const AVATAR_CONTROLS_HEIGHT_PX = 100

function VtoAvatar({ frameUrls }: VtoAvatarProps) {
  const [containerHeightPx, setContainerHeightPx] = useState<number>(window.innerHeight)
  const topContainerRef = useRef<HTMLDivElement>(null)
  const [selectedFrameIndex, setSelectedFrameIndex] = useState<number>(0)
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
      // '@media screen and (min-width: 1024px)': {
      //   left: '32px',
      // },
    },
    chevronRightContainer: {
      position: 'absolute',
      top: '50%',
      right: '0',
      transform: 'translateY(-50%)',
      cursor: 'pointer',
      // '@media screen and (min-width: 1024px)': {
      //   right: '32px',
      // },
    },
    chevronIcon: {
      width: '48px',
      height: '48px',
    },
    controlsContainer: {
      position: 'absolute',
      bottom: '0',
      height: AVATAR_CONTROLS_HEIGHT_PX + 'px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      paddingBottom: '32px',
      backgroundColor: '#FFFFFF',
      backgroundImage: `url(${AvatarBottomBackgroundUrl})`,
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
      setContainerHeightPx(topContainerRef.current?.clientHeight ?? window.innerHeight)
    }
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  // Determmine image dimensions based on container height
  const imageHeightPx = containerHeightPx - AVATAR_CONTROLS_HEIGHT_PX
  const imageWidthPx = Math.floor(imageHeightPx / 1.5)

  const rotateLeft = useCallback(() => {
    setSelectedFrameIndex((prevIndex) => (prevIndex === 0 ? (frameUrls ? frameUrls.length - 1 : 0) : prevIndex - 1))
  }, [frameUrls])
  const rotateRight = useCallback(() => {
    setSelectedFrameIndex((prevIndex) => (prevIndex === (frameUrls ? frameUrls.length - 1 : 0) ? 0 : prevIndex + 1))
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

  if (!frameUrls || frameUrls.length === 0) {
    return <Loading />
  }
  return (
    <div ref={topContainerRef} css={css.topContainer} style={{ width: imageWidthPx + 'px' }}>
      <div css={css.imageContainer} style={{ width: imageWidthPx + 'px', height: imageHeightPx + 'px' }}>
        <img
          src={frameUrls[selectedFrameIndex]}
          css={css.image}
          style={{ width: imageWidthPx + 'px', height: imageHeightPx + 'px' }}
          onMouseDown={handleImageDrag}
        />
        <div css={css.chevronLeftContainer} onClick={rotateLeft}>
          <ChevronLeftIcon css={css.chevronIcon} />
        </div>
        <div css={css.chevronRightContainer} onClick={rotateRight}>
          <ChevronRightIcon css={css.chevronIcon} />
        </div>
      </div>
      <div css={css.controlsContainer} style={{ width: imageWidthPx + 'px' }}>
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
    </div>
  )
}

interface SizeRecommendationProps {
  loadedProductData: LoadedProductData
  selectedSizeLabel: string | null
  onChangeSize: (newSizeLabel: string) => void
}

function SizeRecommendation({ loadedProductData, selectedSizeLabel, onChangeSize }: SizeRecommendationProps) {
  const { t } = useTranslation()
  const css = useCss((_theme) => ({
    frame: {
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
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
    },
    sizeSelectorButton: {
      width: '54px',
      height: '44px',
      border: '1px solid rgba(33, 32, 31, 0.2)',
      padding: '9px 5px',
    },
    sizeSelectorButtonSelected: {
      border: '1px solid rgb(33, 32, 31)',
      cursor: 'default',
    },
    fitContainer: {
      marginTop: '24px',
      width: '100%',
    },
    fitLine: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: '8px',
      marginTop: '4px',
      borderTop: '1px solid rgb(33, 32, 31)',
      paddingTop: '4px',
    },
    fitFirstLine: {
      borderTop: 'none',
      marginTop: '0px',
      paddingTop: '0px',
    },
    fitDetail: {
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
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
            css={{ ...css.sizeSelectorButton, ...(isSelected && css.sizeSelectorButtonSelected) }}
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
        <div key={index} css={[css.fitLine, index === 0 && css.fitFirstLine]}>
          <div css={css.fitDetail}>{locationLabel}</div>
          <div css={css.fitDetail}>
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

  return (
    <div css={css.frame}>
      <div css={css.recommendedSizeContainer}>
        <InfoIcon />
        <TextT
          variant="base"
          css={css.recommendedSizeText}
          t="size-rec.recommended_size"
          vars={{ size: loadedProductData.recommendedSizeLabel }}
        />
      </div>
      <div css={css.itemFitContainer}>
        <TextT
          variant="base"
          css={css.itemFitText}
          t="size-rec.item_fit"
          vars={{
            fit:
              t(`size-rec.fitClassification.${loadedProductData.fitClassification}`) ||
              loadedProductData.fitClassification,
          }}
        />
      </div>
      <div css={css.selectSizeLabelContainer}>
        <TextT variant="base" css={css.selectSizeLabelText} t="size-rec.select_size" />
      </div>
      <div css={css.sizeSelectorContainer}>{sizeSelectorNodeList}</div>
      <div css={css.fitContainer}>{fitLineNodeList}</div>
    </div>
  )
}
