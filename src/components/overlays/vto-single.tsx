import { useCallback, useEffect, useMemo, useState } from 'react'
import { ButtonT } from '@/components/button'
import { ModalTitlebar, SidecarModalFrame } from '@/components/modal'
import { LinkT } from '@/components/link'
import { Text, TextT } from '@/components/text'
import { getSizeRecommendation, getSizeLabelFromSize, requestVtoSingle } from '@/lib/api'
import { ChevronLeftIcon, ChevronRightIcon, TfrNameSvg } from '@/lib/asset'
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
  colors: LoadedSizeColorData[]
}

interface LoadedProductData {
  productName: string
  productDescriptionHtml: string
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
    leftContainer: {
      width: '50%',
    },
    rightContainer: {
      width: '50%',
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
      marginTop: '16px',
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
        const selectedColor = currentProduct.getSelectedColor()

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
          const recommendedSizeId = sizeRecommendationRecord.recommended_size.id
          const sizes: LoadedSizeData[] = sizeRecommendationRecord.available_sizes.map((sizeRec) => {
            const sizeId = sizeRec.id
            const sizeLabel = getSizeLabelFromSize(sizeRec) ?? '(unknown)'
            const isRecommended = sizeRec.id === recommendedSizeId
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
            return {
              sizeId,
              sizeLabel,
              isRecommended,
              colors,
            }
          })
          productData = {
            productName,
            productDescriptionHtml,
            recommendedSizeId,
            recommendedSizeLabel,
            sizes,
          }
        }
        let recommendedColorLabel: string
        {
          const recommendedSizeRecord = productData.sizes.find((s) => s.isRecommended)!
          const recommendedColorRecord =
            recommendedSizeRecord.colors.find((c) => {
              return c.colorLabel === selectedColor
            }) || recommendedSizeRecord.colors[0]
          recommendedColorLabel = recommendedColorRecord.colorLabel
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
    const sizeColorRecord = sizeRecord.colors.find((c) => c.colorLabel === selectedColorLabel) ?? null
    const availableColorLabels = sizeRecord.colors.map((c) => c.colorLabel)
    return { sizeColorRecord, availableColorLabels }
  }, [loadedProductData, selectedSizeLabel, selectedColorLabel])

  // Trigger VTO request when size/color selection changes
  useEffect(() => {
    if (selectedColorSizeRecord) {
      requestVtoSingle(selectedColorSizeRecord.colorwaySizeAssetId)
    }
  }, [selectedColorSizeRecord])

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
      if (!selectedColorLabel || !selectedSizeLabel) {
        return
      }
      const { currentProduct } = getStaticData()
      currentProduct.setSelectedColor(selectedColorLabel)
      currentProduct.setSelectedSize(selectedSizeLabel)
      await currentProduct.addToCart()
      closeOverlay()
    } catch (error) {
      logger.logError('Error adding to cart:', error)
    }
  }, [selectedColorLabel, selectedSizeLabel])

  // RENDERING:

  if (!userIsLoggedIn || !userHasAvatar || !loadedProductData || !selectedColorSizeRecord) {
    return (
      <SidecarModalFrame onRequestClose={closeOverlay}>
        <div>loading</div>
      </SidecarModalFrame>
    )
  }

  return (
    <SidecarModalFrame onRequestClose={closeOverlay}>
      <div css={css.mainContainer}>
        <div css={css.leftContainer}>
          <VtoAvatarView frameUrls={frameUrls} />
        </div>
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
            <div css={css.sizeRecContainer}>size-rec</div>
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

interface VtoAvatarViewProps {
  frameUrls: string[] | null
}

function VtoAvatarView({ frameUrls }: VtoAvatarViewProps) {
  const [selectedFrameIndex, setSelectedFrameIndex] = useState<number>(0)
  const css = useCss((theme) => ({
    topContainer: {
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'start',
      backgroundColor: '#f0f0f0',
    },
    imageContainer: {
      display: 'flex',
      position: 'absolute',
    },
    image: {
      width: '100%',
      height: 'auto',
      cursor: 'grab',
    },
    chevronLeftContainer: {
      position: 'absolute',
      top: '50%',
      left: '16px',
      transform: 'translateY(-50%)',
      cursor: 'pointer',
    },
    chevronRightContainer: {
      position: 'absolute',
      top: '50%',
      right: '16px',
      transform: 'translateY(-50%)',
      cursor: 'pointer',
    },
    chevronIcon: {
      width: '48px',
      height: '48px',
    },
    sliderContainer: {
      position: 'absolute',
      bottom: '0px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      paddingBottom: '32px',
    },
    sliderInput: {
      width: '300px',
      accentColor: theme.color_tfr_800,
    },
    sliderText: {
      color: '#303030',
    },
  }))

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
    return <div>loading</div>
  }
  return (
    <div css={css.topContainer}>
      <div css={css.imageContainer}>
        <img src={frameUrls[selectedFrameIndex]} css={css.image} onMouseDown={handleImageDrag} />
        <div css={css.chevronLeftContainer} onClick={rotateLeft}>
          <ChevronLeftIcon css={css.chevronIcon} />
        </div>
        <div css={css.chevronRightContainer} onClick={rotateRight}>
          <ChevronRightIcon css={css.chevronIcon} />
        </div>
      </div>
      <div css={css.sliderContainer}>
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
