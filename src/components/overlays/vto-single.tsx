import { useEffect, useMemo, useState } from 'react'
import { ModalTitlebar, SidecarModalFrame } from '@/components/modal'
import { getSizeRecommendation, requestVtoSingle, Size } from '@/lib/api'
import { getStyleByExternalId } from '@/lib/database'
import { useTranslation } from '@/lib/locale'
import { getStaticData, useMainStore } from '@/lib/store'
import { useCss } from '@/lib/theme'
import { OverlayName } from '@/lib/view'

interface LoadedSizeColorData {
  colorwaySizeAssetId: number
  colorLabel: string
  sku: string
}

interface LoadedSizeData {
  sizeId: number
  sizeLabel: string
  isRecommended: boolean
  colors: LoadedSizeColorData[]
}

interface LoadedProductData {
  recommendedSizeId: number
  recommendedSizeLabel: string
  sizes: LoadedSizeData[]
}

function getSizeLabelFromSize(size: Size): string {
  if (size.label) {
    return size.label
  }
  return size.size_value?.name ?? '(unknown size)'
}

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
  const css = useCss((_theme) => ({
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
    },
    contentContainer: {
      display: 'flex',
      flexDirection: 'column',
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
        const variants = currentProduct.variants
        const selectedColor = currentProduct.getSelectedColor()

        // Fetch style and size recommendation
        const styleRec = await getStyleByExternalId(brandId, currentProduct.externalId)
        if (!styleRec) {
          console.error('[TFR] Style not found for externalId:', currentProduct.externalId)
          return
        }
        const sizeRecommendationRec = await getSizeRecommendation(styleRec.id)

        // Assemble loaded product data
        let productData: LoadedProductData
        const recommendedSizeLabel = getSizeLabelFromSize(sizeRecommendationRec.recommended_size)
        {
          const recommendedSizeId = sizeRecommendationRec.recommended_size.id
          const sizes: LoadedSizeData[] = sizeRecommendationRec.available_sizes.map((sizeRec) => {
            const sizeId = sizeRec.id
            const sizeLabel = getSizeLabelFromSize(sizeRec)
            const isRecommended = sizeRec.id === recommendedSizeId
            const colors: LoadedSizeColorData[] = sizeRec.colorway_size_assets.map((csaRec) => {
              const colorwaySizeAssetId = csaRec.id
              const sku = csaRec.sku
              const variant = variants.find((v) => v.sku === sku)
              const colorLabel = (variant ? variant.color : csaRec.colorway_name) || '(unknown color)'
              return {
                colorwaySizeAssetId,
                colorLabel,
                sku,
              }
            })
            return {
              sizeId,
              sizeLabel,
              isRecommended,
              colors,
            }
          })
          productData = {
            recommendedSizeId,
            recommendedSizeLabel,
            sizes,
          }
        }
        let recommendedColorLabel: string
        {
          const recommendedSizeRec = productData.sizes.find((s) => s.isRecommended)!
          const recommendedColorRec =
            recommendedSizeRec.colors.find((c) => {
              return c.colorLabel === selectedColor
            }) || recommendedSizeRec.colors[0]
          recommendedColorLabel = recommendedColorRec.colorLabel
        }
        setLoadedProductData(productData)
        setSelectedSizeLabel(recommendedSizeLabel)
        setSelectedColorLabel(recommendedColorLabel)
      } catch (error) {
        console.error('[TFR] Error fetching VTO data:', error)
      }
    }
    fetchInitialData()
  }, [userIsLoggedIn, userHasAvatar])

  // Derive selected color/size data from selections
  const selectedColorSizeRec = useMemo<LoadedSizeColorData | null>(() => {
    if (!loadedProductData) {
      return null
    }
    const sizeRec = loadedProductData.sizes.find((s) => s.sizeLabel === selectedSizeLabel)
    if (!sizeRec) {
      return null
    }
    return sizeRec.colors.find((c) => c.colorLabel === selectedColorLabel) ?? null
  }, [loadedProductData, selectedSizeLabel, selectedColorLabel])

  // Trigger VTO request when size/color selection changes
  useEffect(() => {
    if (selectedColorSizeRec) {
      requestVtoSingle(selectedColorSizeRec.colorwaySizeAssetId)
    }
  }, [selectedColorSizeRec])

  // Lookup VTO frames when user profile changes
  const vtoData = useMemo(() => {
    if (!userProfile || !selectedColorSizeRec) {
      return null
    }
    return userProfile.vto?.[brandId]?.[selectedColorSizeRec.sku] ?? null
  }, [selectedColorSizeRec, userProfile])
  const frameUrls = vtoData?.frames ?? null

  // RENDERING:

  if (!userIsLoggedIn || !userHasAvatar) {
    return null
  }

  return (
    <SidecarModalFrame onRequestClose={closeOverlay}>
      <div css={css.mainContainer}>
        <div css={css.leftContainer}>
          <VtoAvatarView frameUrls={frameUrls} />
        </div>
        <div css={css.rightContainer}>
          <ModalTitlebar title={t('try_it_on')} onCloseClick={closeOverlay} />
          <div css={css.contentContainer}>content</div>
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
  const css = useCss((_theme) => ({
    container: {
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#f0f0f0',
    },
    image: {
      maxWidth: '100%',
      maxHeight: 'calc(100% - 64px)',
    },
    sliderContainer: {
      height: '64px',
    }
  }))

  // RENDERING:

  if (!frameUrls || frameUrls.length === 0) {
    return <div>loading</div>
  }
  return (
    <div css={css.container}>
      <img src={frameUrls[selectedFrameIndex!]} css={css.image} />
      <div css={css.sliderContainer}>
        <input
          type="range"
          min={0}
          max={frameUrls.length - 1}
          step={1}
          value={selectedFrameIndex}
          onChange={(e) => setSelectedFrameIndex(Number(e.target.value))}
        />
      </div>
    </div>
  )
}
