import { useCallback, useMemo } from 'react'
import { AddToCartButton } from '@/components/add-to-cart-button'
import { Button } from '@/components/button'
import { ItemFitDetails } from '@/components/item-fit-details'
import { ItemFitText } from '@/components/item-fit-text'
import { LinkT } from '@/components/link'
import { SizeSelector } from '@/components/size-selector'
import { Text, TextT } from '@/components/text'
import { VtoProductData } from '@/components/product-sizing-types'
import { ResolvedFittingRoomItem } from '@/lib/fitting-room-data'
import { useTranslation } from '@/lib/locale'
import { useCss } from '@/lib/theme'
import { buildVtoProductDataFromResolved } from './product-data'

export type DetailMode = 'compact' | 'expanded'
export type Platform = 'desktop' | 'mobile'

interface DetailAccordionItemProps {
  item: ResolvedFittingRoomItem
  isOpen: boolean
  platform: Platform
  forceUntuck: boolean
  // Mobile-only — desktop ignores these.
  detailMode: DetailMode
  isMobileQuickRow: boolean
  onToggleOpen: () => void
  onChangeDetailMode: (mode: DetailMode) => void
  onChangeSize: (sizeLabel: string) => void
  onAddToCart: () => void
  onToggleUntuck: () => void
}

export function DetailAccordionItem({
  item,
  isOpen,
  platform,
  forceUntuck,
  detailMode,
  isMobileQuickRow,
  onToggleOpen,
  onChangeDetailMode,
  onChangeSize,
  onAddToCart,
  onToggleUntuck,
}: DetailAccordionItemProps) {
  const productData = useMemo(() => buildVtoProductDataFromResolved(item), [item])

  const selectedSizeLabel = useMemo(() => {
    if (!productData) return null
    const csaId = item.storage.colorwaySizeAssetId
    if (csaId == null) return null
    for (const sizeRec of productData.sizes) {
      if (sizeRec.colors.some((c) => c.colorwaySizeAssetId === csaId)) {
        return sizeRec.sizeLabel
      }
    }
    return null
  }, [productData, item.storage.colorwaySizeAssetId])

  // Currently-selected price: look up via stored colorwaySizeAssetId.
  const currentPrice = useMemo(() => {
    if (!productData) return null
    const csaId = item.storage.colorwaySizeAssetId
    if (csaId == null) return null
    for (const sizeRec of productData.sizes) {
      const c = sizeRec.colors.find((c) => c.colorwaySizeAssetId === csaId)
      if (c) return c.priceFormatted
    }
    return null
  }, [productData, item.storage.colorwaySizeAssetId])

  const categoryLabel = item.styleCategory?.label_singular ?? item.styleCategory?.label ?? ''
  const productName = item.merchantProduct?.productName ?? item.externalId
  const tuckable = !!item.styleCategory?.tuckable

  if (platform === 'desktop') {
    return (
      <DesktopAccordionItem
        isOpen={isOpen}
        categoryLabel={categoryLabel}
        productData={productData}
        currentPrice={currentPrice}
        selectedSizeLabel={selectedSizeLabel}
        onToggleOpen={onToggleOpen}
        onChangeSize={onChangeSize}
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
      currentPrice={currentPrice}
      detailMode={detailMode}
      isMobileQuickRow={isMobileQuickRow}
      tuckable={tuckable}
      forceUntuck={forceUntuck}
      onToggleOpen={onToggleOpen}
      onChangeDetailMode={onChangeDetailMode}
      onChangeSize={onChangeSize}
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
  onToggleOpen: () => void
  onChangeSize: (sizeLabel: string) => void
  onAddToCart: () => void
}

function DesktopAccordionItem({
  isOpen,
  categoryLabel,
  productData,
  currentPrice,
  selectedSizeLabel,
  onToggleOpen,
  onChangeSize,
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
      fontSize: '16px',
      fontWeight: '400',
    },
    chevron: {
      display: 'inline-flex',
      alignItems: 'center',
      color: theme.color_fg_text,
      flex: 'none',
    },
    chevronIcon: {
      transition: 'transform 200ms ease',
    },
    chevronIconOpen: {
      transform: 'rotate(180deg)',
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
    sizeBox: {
      width: '100%',
      border: `1px solid ${theme.color_fg_text}`,
      padding: '20px 24px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '12px',
      marginTop: '8px',
      textAlign: 'center',
    },
    recommendedSize: {
      fontSize: '13px',
      fontWeight: '600',
    },
    selectPrompt: {
      fontSize: '12px',
    },
    fitText: {
      fontSize: '12px',
    },
    fitDetails: {
      width: '100%',
    },
    sizeRow: {
      display: 'flex',
      gap: '8px',
      alignItems: 'center',
      justifyContent: 'center',
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
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            css={isOpen ? { ...css.chevronIcon, ...css.chevronIconOpen } : css.chevronIcon}
          >
            <path
              d="M6 9L12 15L18 9"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
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
  currentPrice: string | null
  detailMode: DetailMode
  isMobileQuickRow: boolean
  tuckable: boolean
  forceUntuck: boolean
  onToggleOpen: () => void
  onChangeDetailMode: (mode: DetailMode) => void
  onChangeSize: (sizeLabel: string) => void
  onAddToCart: () => void
  onToggleUntuck: () => void
}

function MobileAccordionItem({
  isOpen,
  categoryLabel,
  productName,
  productData,
  selectedSizeLabel,
  currentPrice,
  detailMode,
  isMobileQuickRow,
  tuckable,
  forceUntuck,
  onToggleOpen,
  onChangeDetailMode,
  onChangeSize,
  onAddToCart,
  onToggleUntuck,
}: MobileProps) {
  const { t } = useTranslation()

  const css = useCss((theme) => ({
    container: {
      display: 'flex',
      flexDirection: 'column',
      borderBottom: `1px solid ${theme.color_fg_text}`,
    },
    header: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '12px 0',
      width: '100%',
      gap: '8px',
    },
    headerLabel: {
      display: 'flex',
      gap: '8px',
      alignItems: 'baseline',
    },
    categoryLabel: {
      fontSize: '12px',
      fontWeight: '600',
      letterSpacing: '0.5px',
      textTransform: 'uppercase',
    },
    productName: {
      fontSize: '12px',
      color: theme.color_fg_text,
    },
    chevron: {
      fontSize: '12px',
    },
    body: {
      display: 'flex',
      flexDirection: 'column',
      gap: '16px',
      padding: '4px 0 16px 0',
    },
    quickRow: {
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '8px 0',
    },
    sizeRow: {
      display: 'flex',
      gap: '8px',
      alignItems: 'center',
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
        <span css={css.chevron}>{isOpen ? '⌃' : '⌄'}</span>
      </Button>

      {!isOpen ? null : isMobileQuickRow ? (
        <div css={css.quickRow}>
          {productData ? (
            <SizeSelector
              loadedProductData={productData}
              selectedSizeLabel={selectedSizeLabel}
              onChangeSize={onChangeSize}
            />
          ) : null}
        </div>
      ) : (
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
              <ItemFitText loadedProductData={productData} />
              <div css={css.fitDetailsContainer}>
                <ItemFitDetails loadedProductData={productData} selectedSizeLabel={selectedSizeLabel} />
              </div>
              <div css={css.buttonContainer}>
                <AddToCartButton onClick={onAddToCart} />
              </div>
              <LinkT
                variant="base"
                css={css.detailsLink}
                t={detailMode === 'compact' ? 'fitting_room.view_product_details' : 'fitting_room.hide_product_details'}
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
                  {tuckable ? (
                    <Button variant="base" css={css.tuckButton} onClick={onToggleUntuck}>
                      {t(tuckLabelKey)}
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </>
          ) : (
            <TextT variant="base" t="loading" />
          )}
        </div>
      )}
    </div>
  )
}
