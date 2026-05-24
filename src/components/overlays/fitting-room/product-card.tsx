import { Button } from '@/components/button'
import { Text } from '@/components/text'
import { CloseIcon } from '@/lib/asset'
import type { ResolvedFittingRoomItem } from '@/lib/fitting-room-data'
import { useCss } from '@/lib/theme'
import type { Availability } from '@/lib/fitting-room-outfit'

interface ProductCardProps {
  item: ResolvedFittingRoomItem
  availability: Availability
  onClick: () => void
  onRemove: () => void
}

// ProductCard renders one garment in the browse rail: image, name, price,
// plus a top-right X to remove from the fitting room. `availability` drives
// the border (selected → solid border) and disabled treatment (greyed +
// non-clickable when other selections rule this one out).
export function ProductCard({ item, availability, onClick, onRemove }: ProductCardProps) {
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
  const selectedVariant = item.merchantProduct?.variants.find(
    (v) => v.color === item.storage.color && (!item.storage.size || v.size === item.storage.size),
  )
  const imageUrl = selectedVariant?.imageUrl ?? item.merchantProduct?.imageUrl ?? null
  const price = selectedVariant?.priceFormatted ?? item.merchantProduct?.variants[0]?.priceFormatted ?? null

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
    </div>
  )
}
