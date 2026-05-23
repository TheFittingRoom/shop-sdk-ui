import { useCallback, useMemo } from 'react'
import { AddToCartButton } from '@/components/add-to-cart-button'
import { Button } from '@/components/button'
import { ColorSelector } from '@/components/color-selector'
import { ItemFitDetails } from '@/components/item-fit-details'
import { ItemFitText } from '@/components/item-fit-text'
import { LinkT } from '@/components/link'
import { SizeSelector } from '@/components/size-selector'
import { Text, TextT } from '@/components/text'
import type { ResolvedFittingRoomItem } from '@/lib/fitting-room-data'
import { buildVtoProductDataFromResolved } from '@/lib/fitting-room-data'
import { useTranslation } from '@/lib/locale'
import type { VtoProductData } from '@/lib/product'
import { useCss } from '@/lib/theme'
import { Chevron } from './chevron'

export type DetailMode = 'compact' | 'expanded'
export type Platform = 'desktop' | 'mobile'

interface DetailAccordionItemProps {
  item: ResolvedFittingRoomItem
  isOpen: boolean
  platform: Platform
  forceUntuck: boolean
  // The outfit has something to tuck into — gates the mobile tuck CTA.
  canTuck: boolean
  // Mobile-only — desktop ignores these.
  detailMode: DetailMode
  isMobileQuickRow: boolean
  onToggleOpen: () => void
  onChangeDetailMode: (mode: DetailMode) => void
  onChangeSize: (sizeLabel: string) => void
  onChangeColor: (colorLabel: string | null) => void
  onAddToCart: () => void
  onToggleUntuck: () => void
}

export function DetailAccordionItem({
  item,
  isOpen,
  platform,
  forceUntuck,
  canTuck,
  detailMode,
  isMobileQuickRow,
  onToggleOpen,
  onChangeDetailMode,
  onChangeSize,
  onChangeColor,
  onAddToCart,
  onToggleUntuck,
}: DetailAccordionItemProps) {
  const productData = useMemo(() => buildVtoProductDataFromResolved(item), [item])

  const selectedSizeLabel = useMemo(() => {
    if (!productData) {
      return null
    }
    const csaId = item.storage.colorwaySizeAssetId
    if (csaId == null) {
      return null
    }
    for (const sizeRec of productData.sizes) {
      if (sizeRec.colors.some((c) => c.colorwaySizeAssetId === csaId)) {
        return sizeRec.sizeLabel
      }
    }
    return null
  }, [productData, item.storage.colorwaySizeAssetId])

  // Currently-selected price: look up via stored colorwaySizeAssetId.
  const currentPrice = useMemo(() => {
    if (!productData) {
      return null
    }
    const csaId = item.storage.colorwaySizeAssetId
    if (csaId == null) {
      return null
    }
    for (const sizeRec of productData.sizes) {
      const c = sizeRec.colors.find((c) => c.colorwaySizeAssetId === csaId)
      if (c) {
        return c.priceFormatted
      }
    }
    return null
  }, [productData, item.storage.colorwaySizeAssetId])

  // Available colours for the currently-selected size. Drives the colour
  // dropdown; ColorSelector hides itself when there are fewer than two.
  const availableColorLabels = useMemo<string[]>(() => {
    if (!productData || !selectedSizeLabel) {
      return []
    }
    const sizeRec = productData.sizes.find((s) => s.sizeLabel === selectedSizeLabel)
    if (!sizeRec) {
      return []
    }
    return sizeRec.colors.map((c) => c.colorLabel).filter((label): label is string => !!label)
  }, [productData, selectedSizeLabel])

  const categoryLabel = item.styleCategory?.label_singular ?? item.styleCategory?.label ?? ''
  const productName = item.merchantProduct?.productName ?? item.externalId
  // Mobile tuck CTA shows only when this item is tuckable AND the outfit has
  // a garment to tuck into (see canTuck in FittingRoomOverlay).
  const tuckable = !!item.styleCategory?.tuckable && canTuck

  if (platform === 'desktop') {
    return (
      <DesktopAccordionItem
        isOpen={isOpen}
        categoryLabel={categoryLabel}
        productData={productData}
        currentPrice={currentPrice}
        selectedSizeLabel={selectedSizeLabel}
        availableColorLabels={availableColorLabels}
        selectedColorLabel={item.storage.color}
        onToggleOpen={onToggleOpen}
        onChangeSize={onChangeSize}
        onChangeColor={onChangeColor}
        onAddToCart={onAddToCart}
      />
    )
  }

  return (
    <MobileAccordionItem
      isOpen={isOpen}
      categoryLabel={categoryLabel}
      productName={productName}
      productData={productData}
      selectedSizeLabel={selectedSizeLabel}
      availableColorLabels={availableColorLabels}
      selectedColorLabel={item.storage.color}
      currentPrice={currentPrice}
      detailMode={detailMode}
      isMobileQuickRow={isMobileQuickRow}
      tuckable={tuckable}
      forceUntuck={forceUntuck}
      onToggleOpen={onToggleOpen}
      onChangeDetailMode={onChangeDetailMode}
      onChangeSize={onChangeSize}
      onChangeColor={onChangeColor}
      onAddToCart={onAddToCart}
      onToggleUntuck={onToggleUntuck}
    />
  )
}

interface DesktopProps {
  isOpen: boolean
  categoryLabel: string
  productData: VtoProductData | null
  currentPrice: string | null
  selectedSizeLabel: string | null
  availableColorLabels: string[]
  selectedColorLabel: string | null
  onToggleOpen: () => void
  onChangeSize: (sizeLabel: string) => void
  onChangeColor: (colorLabel: string | null) => void
  onAddToCart: () => void
}

function DesktopAccordionItem({
  isOpen,
  categoryLabel,
  productData,
  currentPrice,
  selectedSizeLabel,
  availableColorLabels,
  selectedColorLabel,
  onToggleOpen,
  onChangeSize,
  onChangeColor,
  onAddToCart,
}: DesktopProps) {
  // Subtle neutral grey used both as the accordion header background and as
  // the body's 3-sided border when open — gives the visible "frame" around
  // the open item that matches the Figma design.
  const ACCORDION_SHADE = '#F4F4F4'

  const css = useCss((theme) => ({
    container: {
      display: 'flex',
      flexDirection: 'column',
    },
    header: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '14px 20px',
      width: '100%',
      gap: '8px',
      backgroundColor: ACCORDION_SHADE,
    },
    categoryLabel: {
      fontFamily: "'Times New Roman', serif",
      fontSize: '16px',
      fontWeight: '400',
    },
    chevron: {
      display: 'inline-flex',
      alignItems: 'center',
      color: theme.color_fg_text,
      flex: 'none',
    },
    body: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'stretch',
      gap: '14px',
      padding: '20px 24px 24px 24px',
      textAlign: 'left',
      borderLeft: `1px solid ${ACCORDION_SHADE}`,
      borderRight: `1px solid ${ACCORDION_SHADE}`,
      borderBottom: `1px solid ${ACCORDION_SHADE}`,
    },
    productName: {
      fontSize: '24px',
      lineHeight: '1.2',
    },
    price: {
      fontSize: '15px',
    },
    // Padding matches quick-view's sizeRecommendationFrame (32px / 56px) so
    // the "fit box" feels visually consistent between the two overlays.
    //
    // No flex `gap` — the three text lines (recommended size, fit text,
    // select-a-size prompt) sit tight against each other (matching
    // quick-view), with explicit marginTop on the size selector + fit
    // details below them to introduce the larger break.
    sizeBox: {
      width: '100%',
      border: `1px solid ${theme.color_fg_text}`,
      padding: '32px 56px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      marginTop: '8px',
      textAlign: 'center',
    },
    colorSelectorContainer: {
      width: '100%',
      marginTop: '8px',
    },
    // 14px / line-height 1.5 on these three text lines matches quick-view's
    // fit-box. Quick-view's first line wraps an InfoIcon button alongside
    // the recommended-size text, which stretches that line vertically; the
    // simpler line-height bump here matches the *visual* line spacing
    // without dragging the icon in. The two lines below it inherit
    // line-height from their containers in quick-view, which the host page's
    // body styles tend to set looser than Inter's intrinsic `normal` (~1.21).
    recommendedSize: {
      fontSize: '14px',
      fontWeight: '600',
      lineHeight: 1.5,
    },
    selectPrompt: {
      fontSize: '14px',
      lineHeight: 1.5,
    },
    fitText: {
      fontSize: '14px',
      lineHeight: 1.5,
      // Tight 8px lift to the recommended-size line above; matches
      // quick-view's `itemFitContainer` marginTop.
      marginTop: '8px',
    },
    fitDetails: {
      width: '100%',
      marginTop: '24px',
    },
    sizeRow: {
      display: 'flex',
      gap: '8px',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: '24px',
    },
    cartContainer: {
      width: '100%',
      marginTop: '8px',
    },
    description: {
      fontSize: '13px',
      lineHeight: '1.5',
      textAlign: 'left',
      marginTop: '8px',
    },
  }))

  return (
    <div css={css.container}>
      <Button variant="base" css={css.header} onClick={onToggleOpen}>
        <Text variant="base" css={css.categoryLabel}>
          {categoryLabel}
        </Text>
        <span css={css.chevron}>
          <Chevron direction={isOpen ? 'up' : 'down'} />
        </span>
      </Button>
      {!isOpen ? null : (
        <div css={css.body}>
          {productData ? (
            <>
              <Text variant="brand" css={css.productName}>
                {productData.productName}
              </Text>
              {currentPrice ? (
                <Text variant="base" css={css.price}>
                  {currentPrice}
                </Text>
              ) : null}
              <div css={css.colorSelectorContainer}>
                <ColorSelector
                  availableColorLabels={availableColorLabels}
                  selectedColorLabel={selectedColorLabel}
                  onChangeColor={onChangeColor}
                />
              </div>
              <div css={css.sizeBox}>
                <Text variant="base" css={css.recommendedSize}>
                  Recommended Size: {productData.recommendedSizeLabel}
                </Text>
                <ItemFitText loadedProductData={productData} textCss={css.fitText} />
                <TextT variant="base" css={css.selectPrompt} t="size-rec.select_size" />
                <div css={css.sizeRow}>
                  <SizeSelector
                    loadedProductData={productData}
                    selectedSizeLabel={selectedSizeLabel}
                    onChangeSize={onChangeSize}
                  />
                </div>
                <div css={css.fitDetails}>
                  <ItemFitDetails loadedProductData={productData} selectedSizeLabel={selectedSizeLabel} />
                </div>
              </div>
              <div css={css.cartContainer}>
                <AddToCartButton onClick={onAddToCart} />
              </div>
              <Text variant="base" css={css.description}>
                <span dangerouslySetInnerHTML={{ __html: productData.productDescriptionHtml }} />
              </Text>
            </>
          ) : (
            <TextT variant="base" t="loading" />
          )}
        </div>
      )}
    </div>
  )
}

interface MobileProps {
  isOpen: boolean
  categoryLabel: string
  productName: string
  productData: VtoProductData | null
  selectedSizeLabel: string | null
  availableColorLabels: string[]
  selectedColorLabel: string | null
  currentPrice: string | null
  detailMode: DetailMode
  isMobileQuickRow: boolean
  tuckable: boolean
  forceUntuck: boolean
  onToggleOpen: () => void
  onChangeDetailMode: (mode: DetailMode) => void
  onChangeSize: (sizeLabel: string) => void
  onChangeColor: (colorLabel: string | null) => void
  onAddToCart: () => void
  onToggleUntuck: () => void
}

function MobileAccordionItem({
  isOpen,
  categoryLabel,
  productName,
  productData,
  selectedSizeLabel,
  availableColorLabels,
  selectedColorLabel,
  currentPrice,
  detailMode,
  isMobileQuickRow,
  tuckable,
  forceUntuck,
  onToggleOpen,
  onChangeDetailMode,
  onChangeSize,
  onChangeColor,
  onAddToCart,
  onToggleUntuck,
}: MobileProps) {
  const { t } = useTranslation()

  // Light grey for the section card — the header tints over it and a ~6px
  // frame of it surrounds the white content.
  const ACCORDION_SHADE = '#EEEEEE'

  const css = useCss((theme) => ({
    container: {
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: ACCORDION_SHADE,
      borderRadius: '10px',
      overflow: 'hidden',
    },
    header: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '14px 16px',
      width: '100%',
      gap: '8px',
      backgroundColor: 'transparent',
    },
    headerLabel: {
      display: 'flex',
      gap: '8px',
      alignItems: 'baseline',
      flex: 1,
      minWidth: 0,
    },
    categoryLabel: {
      fontFamily: "'Times New Roman', serif",
      fontSize: '15px',
      fontWeight: '400',
      flex: 'none',
    },
    productName: {
      fontFamily: "'Times New Roman', serif",
      fontSize: '15px',
      color: '#8A8A8A',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      minWidth: 0,
    },
    chevron: {
      display: 'inline-flex',
      alignItems: 'center',
      color: theme.color_fg_text,
      flex: 'none',
    },
    content: {
      backgroundColor: '#FFFFFF',
      margin: '0 6px 6px 6px',
      borderRadius: '6px',
      padding: '16px',
    },
    body: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      textAlign: 'center',
      gap: '16px',
    },
    quickRow: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '12px',
    },
    sizeRow: {
      display: 'flex',
      gap: '8px',
      alignItems: 'center',
      justifyContent: 'center',
    },
    fitDetailsContainer: {
      width: 'min(100%, 220px)',
    },
    buttonContainer: {
      width: '100%',
      maxWidth: '375px',
    },
    detailsLink: {
      fontSize: '13px',
      textDecoration: 'underline',
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
      cursor: 'pointer',
    },
    expandedBlock: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      alignSelf: 'stretch',
      gap: '8px',
      marginTop: '8px',
    },
    expandedTitle: {
      fontSize: '18px',
      fontWeight: '500',
    },
    expandedPrice: {
      fontSize: '14px',
    },
    expandedDescription: {
      fontSize: '12px',
      // Description stays left-aligned while every other detail is centered.
      alignSelf: 'stretch',
      textAlign: 'left',
    },
    tuckButton: {
      width: '100%',
      maxWidth: '375px',
      padding: '12px 16px',
      borderRadius: '24px',
      backgroundColor: '#FFFFFF',
      color: theme.color_fg_text,
      border: `1px solid ${theme.color_fg_text}`,
      fontSize: '13px',
      fontWeight: '500',
      letterSpacing: '0.5px',
      textTransform: 'uppercase',
      cursor: 'pointer',
    },
  }))

  const handleViewDetailsClick = useCallback(() => {
    onChangeDetailMode(detailMode === 'compact' ? 'expanded' : 'compact')
  }, [detailMode, onChangeDetailMode])

  const tuckLabelKey = forceUntuck ? 'fitting_room.try_it_tucked_in' : 'fitting_room.try_it_untucked'

  return (
    <div css={css.container}>
      <Button variant="base" css={css.header} onClick={onToggleOpen}>
        <div css={css.headerLabel}>
          <Text variant="base" css={css.categoryLabel}>
            {categoryLabel}
          </Text>
          <Text variant="base" css={css.productName}>
            {productName}
          </Text>
        </div>
        <span css={css.chevron}>
          <Chevron direction={isOpen ? 'up' : 'down'} />
        </span>
      </Button>

      {isMobileQuickRow ? (
        <div css={css.content}>
          <div css={css.quickRow}>
            {productData ? (
              <SizeSelector
                loadedProductData={productData}
                selectedSizeLabel={selectedSizeLabel}
                onChangeSize={onChangeSize}
              />
            ) : null}
          </div>
        </div>
      ) : !isOpen ? null : (
        <div css={css.content}>
          <div css={css.body}>
            {productData ? (
              <>
                <div css={css.sizeRow}>
                  <SizeSelector
                    loadedProductData={productData}
                    selectedSizeLabel={selectedSizeLabel}
                    onChangeSize={onChangeSize}
                  />
                </div>
                <ColorSelector
                  availableColorLabels={availableColorLabels}
                  selectedColorLabel={selectedColorLabel}
                  onChangeColor={onChangeColor}
                />
                <ItemFitText loadedProductData={productData} />
                <div css={css.fitDetailsContainer}>
                  <ItemFitDetails loadedProductData={productData} selectedSizeLabel={selectedSizeLabel} />
                </div>
                <div css={css.buttonContainer}>
                  <AddToCartButton onClick={onAddToCart} />
                </div>
                {/* Tuck CTA sits directly below ADD TO CART, always visible
                  when the outfit can be tucked (canTuck-gated via `tuckable`)
                  — no longer hidden behind "view product details". */}
                {tuckable ? (
                  <Button variant="base" css={css.tuckButton} onClick={onToggleUntuck}>
                    {t(tuckLabelKey)}
                  </Button>
                ) : null}
                <LinkT
                  variant="base"
                  css={css.detailsLink}
                  t={
                    detailMode === 'compact' ? 'fitting_room.view_product_details' : 'fitting_room.hide_product_details'
                  }
                  onClick={handleViewDetailsClick}
                />
                {detailMode === 'expanded' ? (
                  <div css={css.expandedBlock}>
                    <Text variant="brand" css={css.expandedTitle}>
                      {productData.productName}
                    </Text>
                    {currentPrice ? (
                      <Text variant="base" css={css.expandedPrice}>
                        {currentPrice}
                      </Text>
                    ) : null}
                    <Text variant="base" css={css.expandedDescription}>
                      <span dangerouslySetInnerHTML={{ __html: productData.productDescriptionHtml }} />
                    </Text>
                  </div>
                ) : null}
              </>
            ) : (
              <TextT variant="base" t="loading" />
            )}
          </div>
        </div>
      )}
    </div>
  )
}
