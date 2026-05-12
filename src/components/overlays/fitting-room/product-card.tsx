import { Button } from '@/components/button'
import { Text } from '@/components/text'
import { ResolvedFittingRoomItem } from '@/lib/fitting-room-data'
import { useCss } from '@/lib/theme'
import { Availability } from './availability'

interface ProductCardProps {
  item: ResolvedFittingRoomItem
  availability: Availability
  onClick: () => void
}

// ProductCard renders one garment in the browse rail: image, name, price.
// `availability` drives the border (selected → solid border) and disabled
// treatment (greyed + non-clickable when other selections rule this one out).
export function ProductCard({ item, availability, onClick }: ProductCardProps) {
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
      cursor: 'pointer',
      backgroundColor: 'transparent',
      textAlign: 'left',
    },
    containerSelected: {
      border: `1px solid ${theme.color_fg_text}`,
    },
    containerDisabled: {
      opacity: 0.35,
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
  }))

  const disabled = availability === 'disabled'
  const selected = availability === 'selected'

  const handleClick = () => {
    if (disabled) return
    onClick()
  }

  const name = item.merchantProduct?.productName ?? item.externalId
  const imageUrl = item.merchantProduct?.imageUrl ?? null

  // Pick a price from variants if available — first variant's price is fine
  // for the rail; the accordion shows the precise selected-size price.
  const price = item.merchantProduct?.variants[0]?.priceFormatted ?? null

  return (
    <Button
      variant="base"
      css={{
        ...css.container,
        ...(selected && css.containerSelected),
        ...(disabled && css.containerDisabled),
      }}
      onClick={handleClick}
      disabled={disabled}
    >
      <div css={css.imageContainer}>
        {imageUrl ? <img src={imageUrl} css={css.image} alt={name} /> : null}
      </div>
      <Text variant="base" css={css.nameText}>
        {name}
      </Text>
      {price ? (
        <Text variant="base" css={css.priceText}>
          {price}
        </Text>
      ) : null}
    </Button>
  )
}
