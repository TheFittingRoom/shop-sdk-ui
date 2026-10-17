import { Button } from '@/components/button'
import { TextT } from '@/components/text'
import { CloseIcon } from '@/lib/asset'
import type { CssProp } from '@/lib/theme'
import { useCss } from '@/lib/theme'

interface ClearAllPillProps {
  onClick: () => void
  // Where the pill floats. Each layout pins it absolutely inside a pane that
  // does not scroll, so it stays put while the cards scroll under it.
  position: CssProp
}

// ClearAllPill is the fitting room's floating Clear All control, shared by the
// desktop card pane and mobile browse view so the two can't drift apart:
// white pill with a thin black border and black uppercase text. Its shape
// matches the mobile SectionNav pill, inverted on colour for contrast.
export function ClearAllPill({ onClick, position }: ClearAllPillProps) {
  const css = useCss((theme) => ({
    pill: {
      zIndex: 5,
      display: 'inline-flex',
      alignItems: 'center',
      gap: '8px',
      padding: '6px 16px',
      borderRadius: '999px',
      backgroundColor: '#FFFFFF',
      color: theme.color_fg_text,
      border: `1px solid ${theme.color_fg_text}`,
      cursor: 'pointer',
      fontSize: '13px',
      fontWeight: '500',
      letterSpacing: '0.5px',
      textTransform: 'uppercase',
      whiteSpace: 'nowrap',
    },
    // Text's `base` variant sets its own colour (theme.color_fg_text), which
    // would otherwise win over the pill's.
    text: {
      color: theme.color_fg_text,
    },
    icon: {
      width: '12px',
      height: '12px',
      flex: 'none',
      // close-icon.svg's <path>s have a hardcoded dark fill — already matches
      // the black-on-white pill, no override needed.
    },
  }))
  return (
    <Button variant="base" css={{ ...css.pill, ...position }} onClick={onClick}>
      <TextT variant="base" css={css.text} t="fitting_room.clear_all" />
      <CloseIcon css={css.icon} />
    </Button>
  )
}
