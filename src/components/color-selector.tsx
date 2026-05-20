import { useCallback } from 'react'
import { TextT } from '@/components/text'
import { useCss } from '@/lib/theme'

export interface ColorSelectorProps {
  availableColorLabels: string[]
  selectedColorLabel: string | null
  onChangeColor: (newColorLabel: string | null) => void
}

// Color dropdown shared by quick-view and the fitting-room detail accordion.
// Renders nothing when fewer than two colours are available — the selector
// would otherwise show a single locked option.
export function ColorSelector({ availableColorLabels, selectedColorLabel, onChangeColor }: ColorSelectorProps) {
  const css = useCss((theme) => ({
    colorContainer: {},
    colorLabelText: {
      fontSize: '12px',
    },
    colorSelect: {
      border: 'none',
      color: theme.color_fg_text,
      fontFamily: theme.font_family,
      fontSize: '12px',
    },
  }))

  const handleColorSelectChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newColorLabel = e.target.value || null
      onChangeColor(newColorLabel)
    },
    [onChangeColor],
  )

  if (availableColorLabels.length < 2) {
    return null
  }
  return (
    <div css={css.colorContainer}>
      <label>
        <TextT variant="base" css={css.colorLabelText} t="quick-view.color_label" />
        <select value={selectedColorLabel ?? ''} onChange={handleColorSelectChange} css={css.colorSelect}>
          {availableColorLabels.map((colorLabel) => (
            <option key={colorLabel} value={colorLabel}>
              {colorLabel}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}
