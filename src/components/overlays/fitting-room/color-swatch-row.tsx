import { Button } from '@/components/button'
import { useCss } from '@/lib/theme'

export interface ColorSwatchEntry {
  label: string
  imageUrl: string | null
  hex: string | null
}

interface ColorSwatchRowProps {
  colors: ColorSwatchEntry[]
  selectedLabel: string | null
  onSelect: (label: string) => void
}

// ColorSwatchRow renders a wrappable row of small swatches for picking a
// product colour from the fitting-room rail card. Render preference per
// swatch: image (Shopify Online Store 2.0 swatch image) → hex circle
// (Shopify Online Store 2.0 swatch.color) → small text label. Self-hides
// when fewer than two colours are available — a single-colour product
// doesn't need a picker.
//
// Selected colour gets a thin dark outline ring with a small inset so the
// ring sits cleanly outside the swatch fill. Press-targets are 24px; the
// row wraps onto multiple lines when the card has more colours than fit
// in one row, growing the card downward (CardRail's flex row stretches
// siblings to match, keeping cards visually aligned).
export function ColorSwatchRow({ colors, selectedLabel, onSelect }: ColorSwatchRowProps) {
  const css = useCss((theme) => ({
    row: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: '6px',
    },
    swatch: {
      width: '24px',
      height: '24px',
      borderRadius: '50%',
      padding: 0,
      border: '1px solid rgba(0, 0, 0, 0.15)',
      backgroundColor: '#FFFFFF',
      cursor: 'pointer',
      overflow: 'hidden',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      // Reset native button chrome so the circle renders crisply.
      appearance: 'none',
      WebkitAppearance: 'none',
    },
    swatchSelected: {
      outline: `2px solid ${theme.color_fg_text}`,
      outlineOffset: '1px',
      borderColor: 'transparent',
    },
    swatchImage: {
      width: '100%',
      height: '100%',
      objectFit: 'cover',
    },
    // Tiny text label, used only as a last-resort fallback when neither an
    // image nor a hex is available. Truncates so a long colour name
    // doesn't break the swatch shape.
    swatchTextLabel: {
      fontSize: '9px',
      lineHeight: 1,
      color: theme.color_fg_text,
      padding: '0 2px',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      maxWidth: '100%',
    },
  }))

  if (colors.length < 2) {
    return null
  }

  return (
    <div css={css.row}>
      {colors.map((c) => {
        const isSelected = c.label === selectedLabel
        const fillStyle = c.imageUrl ? undefined : c.hex ? { backgroundColor: c.hex } : undefined
        return (
          <Button
            key={c.label}
            variant="base"
            css={isSelected ? { ...css.swatch, ...css.swatchSelected } : css.swatch}
            style={fillStyle}
            onClick={() => onSelect(c.label)}
            aria-label={`Pick colour ${c.label}`}
            aria-pressed={isSelected}
          >
            {c.imageUrl ? (
              <img src={c.imageUrl} alt="" css={css.swatchImage} />
            ) : c.hex ? null : (
              <span css={css.swatchTextLabel}>{c.label.slice(0, 3)}</span>
            )}
          </Button>
        )
      })}
    </div>
  )
}
