import { useMemo } from 'react'
import { Button } from '@/components/button'
import { Text } from '@/components/text'
import { CloseIcon } from '@/lib/asset'
import type { ResolvedFittingRoomItem } from '@/lib/fitting-room-data'
import { useCss } from '@/lib/theme'
import type { Availability } from '@/lib/fitting-room-outfit'
import { ColorSwatchRow, type ColorSwatchEntry } from './color-swatch-row'

interface ProductCardProps {
  item: ResolvedFittingRoomItem
  availability: Availability
  onClick: () => void
  onRemove: () => void
  // Optional — when omitted, the per-card swatch row is hidden entirely.
  // CardRail passes this through on both desktop and mobile-browse.
  onChangeColor?: (externalId: string, colorLabel: string | null) => void
}

// ProductCard renders one garment in the browse rail: image, name, price,
// plus a top-right X to remove from the fitting room. `availability` drives
// the border (selected → solid border) and disabled treatment (greyed +
// non-clickable when other selections rule this one out).
export function ProductCard({ item, availability, onClick, onRemove, onChangeColor }: ProductCardProps) {
  const css = useCss((theme) => ({
    container: {
      position: 'relative',
      width: '160px',
      flex: 'none',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      padding: '8px',
      border: '1px solid transparent',
      backgroundColor: 'transparent',
      textAlign: 'left',
    },
    containerSelected: {
      border: `1px solid ${theme.color_fg_text}`,
    },
    containerDisabled: {
      opacity: 0.35,
    },
    cardBody: {
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      background: 'none',
      border: 'none',
      padding: 0,
      textAlign: 'left',
      cursor: 'pointer',
      fontFamily: theme.font_family,
    },
    cardBodyDisabled: {
      cursor: 'not-allowed',
    },
    imageContainer: {
      width: '100%',
      aspectRatio: '3 / 4',
      backgroundColor: '#F4F4F4',
      overflow: 'hidden',
    },
    image: {
      width: '100%',
      height: '100%',
      objectFit: 'cover',
    },
    nameText: {
      fontSize: '13px',
      lineHeight: '1.3',
    },
    priceText: {
      fontSize: '12px',
      color: theme.color_fg_text,
    },
    removeButton: {
      position: 'absolute',
      top: '4px',
      right: '4px',
      width: '24px',
      height: '24px',
      borderRadius: '12px',
      border: 'none',
      backgroundColor: 'rgba(255, 255, 255, 0.85)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      padding: 0,
      zIndex: 1,
    },
    removeIcon: {
      width: '12px',
      height: '12px',
    },
    // Selected badge — mirrors the X button at the top-right, green-filled
    // circle at top-left with an inline white checkmark. Only rendered when
    // availability === 'selected'. Decorative: pointer-events: none so the
    // shopper still taps the card body underneath to toggle off.
    selectedBadge: {
      position: 'absolute',
      top: '4px',
      left: '4px',
      width: '24px',
      height: '24px',
      borderRadius: '12px',
      backgroundColor: '#22C55E',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      pointerEvents: 'none',
      zIndex: 1,
    },
  }))

  const disabled = availability === 'disabled'
  const selected = availability === 'selected'

  const handleClick = () => {
    if (disabled) {
      return
    }
    onClick()
  }

  const name = item.merchantProduct?.productName ?? item.externalId

  // Look up the variant that matches the stored color (and size when known).
  // Used for both the card image and the price so a multi-colour product
  // shows the right colour swatch the shopper picked, not the merchant's
  // default. Falls back through: variant.imageUrl → product.imageUrl, and
  // variant.priceFormatted → variants[0].priceFormatted, so single-colour
  // products and items without per-variant images still render.
  //
  // When storage.color is null (catalog-add path — no PDP to read color
  // from), match the color that ensureSizeForItem will auto-pick on tap:
  // the recommended size's first CSA. Without this, the card shows the
  // merchant's featured image (often a different color) and then "jumps"
  // to the auto-picked color the moment the shopper taps it. If
  // loadedProduct hasn't landed yet, fall through to the existing
  // product.imageUrl fallback and let the card re-render once it does.
  let effectiveColor = item.storage.color
  if (!effectiveColor && item.loadedProduct) {
    const sizeRec = item.loadedProduct.sizeFitRecommendation
    const recommendedSize = sizeRec.available_sizes.find((s) => s.id === sizeRec.recommended_size.id)
    const firstCsa = recommendedSize?.colorway_size_assets[0]
    if (firstCsa) {
      const variant = item.merchantProduct?.variants.find((v) => v.sku === firstCsa.sku)
      effectiveColor = variant?.color ?? null
    }
  }
  const selectedVariant = item.merchantProduct?.variants.find(
    (v) => v.color === effectiveColor && (!item.storage.size || v.size === item.storage.size),
  )
  const imageUrl = selectedVariant?.imageUrl ?? item.merchantProduct?.imageUrl ?? null
  const price = selectedVariant?.priceFormatted ?? item.merchantProduct?.variants[0]?.priceFormatted ?? null

  // Deduped per-colour swatch entries derived from the merchant variants.
  // Take the first variant for each distinct colour as the source of its
  // swatch metadata — Shopify's Online Store 2.0 native swatches are
  // option-value-scoped (one swatch per colour, shared across sizes), so the
  // metadata is the same across same-colour variants. ColorSwatchRow
  // self-hides for <2 colours, so single-colour products skip the row.
  const swatchColors = useMemo<ColorSwatchEntry[]>(() => {
    const variants = item.merchantProduct?.variants
    if (!variants) {
      return []
    }
    const seen = new Set<string>()
    const out: ColorSwatchEntry[] = []
    for (const v of variants) {
      if (!v.color || seen.has(v.color)) {
        continue
      }
      seen.add(v.color)
      out.push({ label: v.color, imageUrl: v.swatchImageUrl ?? null, hex: v.swatchHex ?? null })
    }
    return out
  }, [item.merchantProduct?.variants])

  const handleSwatchSelect = (label: string) => {
    onChangeColor?.(item.externalId, label)
  }

  return (
    <div
      css={{
        ...css.container,
        ...(selected && css.containerSelected),
        ...(disabled && css.containerDisabled),
      }}
    >
      <button
        css={css.removeButton}
        onClick={(e) => {
          e.stopPropagation()
          onRemove()
        }}
        aria-label="Remove from fitting room"
      >
        <CloseIcon css={css.removeIcon} />
      </button>
      {selected ? (
        <div css={css.selectedBadge} aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M3 8.5L6.5 12L13 4.5"
              stroke="#FFFFFF"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      ) : null}
      <Button
        variant="base"
        css={{
          ...css.cardBody,
          ...(disabled && css.cardBodyDisabled),
        }}
        onClick={handleClick}
        disabled={disabled}
      >
        <div css={css.imageContainer}>{imageUrl ? <img src={imageUrl} css={css.image} alt={name} /> : null}</div>
        <Text variant="base" css={css.nameText}>
          {name}
        </Text>
        {price ? (
          <Text variant="base" css={css.priceText}>
            {price}
          </Text>
        ) : null}
      </Button>
      {/* Swatch row sits OUTSIDE the cardBody button so swatch clicks don't
          bubble up into the select-item handler. ColorSwatchRow itself
          renders nothing when the product has fewer than two colours. Skip
          rendering entirely when no onChangeColor handler is supplied. */}
      {onChangeColor ? (
        <ColorSwatchRow colors={swatchColors} selectedLabel={effectiveColor} onSelect={handleSwatchSelect} />
      ) : null}
    </div>
  )
}
