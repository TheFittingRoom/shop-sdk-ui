import { useMemo, useRef } from 'react'
import { Button } from '@/components/button'
import { HelpTip } from '@/components/help-tooltip'
import { Text } from '@/components/text'
import { TrashIcon } from '@/lib/asset'
import type { ResolvedFittingRoomItem } from '@/lib/fitting-room-data'
import { useTranslation } from '@/lib/locale'
import { useCss } from '@/lib/theme'
import type { Availability } from '@/lib/fitting-room-outfit'
import { CardCheckbox } from './card-checkbox'
import { ColorSwatchRow, type ColorSwatchEntry } from './color-swatch-row'

interface ProductCardProps {
  item: ResolvedFittingRoomItem
  availability: Availability
  onClick: () => void
  onRemove: () => void
  // Optional — when omitted, the per-card swatch row is hidden entirely.
  // CardRail passes this through on both desktop and mobile-browse.
  onChangeColor?: (externalId: string, colorLabel: string | null) => void
  // This card carries the "tap the cards" help popup — the first card of the
  // first rail.
  helpTip?: boolean
}

// ProductCard renders one garment in the browse rail: image, name, price,
// plus a top-right X to remove from the fitting room. `availability` drives
// the border (selected → solid border) and disabled treatment (greyed +
// non-clickable when other selections rule this one out).
export function ProductCard({
  item,
  availability,
  onClick,
  onRemove,
  onChangeColor,
  helpTip = false,
}: ProductCardProps) {
  const { t } = useTranslation()
  const containerRef = useRef<HTMLDivElement>(null)
  const css = useCss((theme) => ({
    container: {
      position: 'relative',
      width: '160px',
      flex: 'none',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      padding: '12px 20px',
      border: '1.5px solid #E0E0E0',
      borderRadius: '8px',
      backgroundColor: 'transparent',
      textAlign: 'left',
    },
    containerSelected: {
      borderColor: theme.color_tfr_800,
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
      top: '8px',
      right: '8px',
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
      width: '14px',
      height: '14px',
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
  // Once the item's data has loaded this is its derived selection (WEB-105),
  // the same size and colour the try-on uses, so the card never shows one
  // variant and the try-on another. Before that, the stored colour (if any)
  // with any size, falling back below to the product's own image.
  const selection = item.selection
  const effectiveColor = selection?.colorLabel ?? item.storage.color
  const selectedVariant = selection
    ? item.merchantProduct?.variants.find((v) => v.color === selection.colorLabel && v.size === selection.sizeLabel)
    : item.merchantProduct?.variants.find((v) => v.color === effectiveColor)
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
      ref={containerRef}
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
        <TrashIcon css={css.removeIcon} />
      </button>
      <CardCheckbox
        state={disabled ? 'disabled' : selected ? 'selected' : 'unselected'}
        onClick={handleClick}
        ariaLabel={t('fitting_room.toggle_selection')}
      />
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
      <HelpTip id="fitting_room_card" enabled={helpTip} anchorRef={containerRef} t="help_tip.fitting_room_card" />
    </div>
  )
}
