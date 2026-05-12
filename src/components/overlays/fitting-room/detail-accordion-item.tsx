import { useCallback, useMemo } from 'react'
import { AddToCartButton } from '@/components/add-to-cart-button'
import { Button } from '@/components/button'
import { ItemFitDetails } from '@/components/item-fit-details'
import { ItemFitText } from '@/components/item-fit-text'
import { LinkT } from '@/components/link'
import { SizeSelector } from '@/components/size-selector'
import { Text, TextT } from '@/components/text'
import { ResolvedFittingRoomItem } from '@/lib/fitting-room-data'
import { useTranslation } from '@/lib/locale'
import { useCss } from '@/lib/theme'
import { buildVtoProductDataFromResolved } from './product-data'

export type DetailMode = 'compact' | 'expanded'

interface DetailAccordionItemProps {
  item: ResolvedFittingRoomItem
  isOpen: boolean
  detailMode: DetailMode
  isMobileQuickRow: boolean
  forceUntuck: boolean
  onToggleOpen: () => void
  onChangeDetailMode: (mode: DetailMode) => void
  onChangeSize: (sizeLabel: string) => void
  onAddToCart: () => void
  onToggleUntuck: () => void
}

// DetailAccordionItem renders one selected fitting-room item.
// - Closed: header row (category-singular + product-name + chevron).
// - Open + isMobileQuickRow: single row with size pills inline (the "RECOMMENDED SIZES" form).
// - Open + compact: header + size pills + fit text + fit details + ADD TO CART + view-details link.
// - Open + expanded: compact + title + price + description + tuck CTA when tuckable (mobile only).
export function DetailAccordionItem({
  item,
  isOpen,
  detailMode,
  isMobileQuickRow,
  forceUntuck,
  onToggleOpen,
  onChangeDetailMode,
  onChangeSize,
  onAddToCart,
  onToggleUntuck,
}: DetailAccordionItemProps) {
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

  const handleViewDetailsClick = useCallback(() => {
    onChangeDetailMode(detailMode === 'compact' ? 'expanded' : 'compact')
  }, [detailMode, onChangeDetailMode])

  const categoryLabel = item.styleCategory?.label_singular ?? item.styleCategory?.label ?? ''
  const productName = item.merchantProduct?.productName ?? item.externalId

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

  const tuckable = !!item.styleCategory?.tuckable
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
        // Quick-row form: size pills inline beside the header.
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
