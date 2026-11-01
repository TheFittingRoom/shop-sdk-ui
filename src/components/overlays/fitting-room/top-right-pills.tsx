import type { ReactNode } from 'react'
import { useCss } from '@/lib/theme'

// TopRightPills floats the fitting room's top-right controls — "Create your
// Mini Me" and the SectionNav — over the card rails, side by side. When the
// row is too wide for a narrow screen it wraps, so the second pill drops
// below the first instead of overflowing. Place it inside a positioned
// container that doesn't scroll.
export function TopRightPills({ children }: { children: ReactNode }) {
  const css = useCss((_theme) => ({
    row: {
      position: 'absolute',
      top: '12px',
      right: '16px',
      // Leave the left side of the pane clear for the section titles.
      maxWidth: 'calc(100% - 32px)',
      display: 'flex',
      flexWrap: 'wrap',
      justifyContent: 'flex-end',
      alignItems: 'center',
      gap: '8px',
      zIndex: 5,
    },
  }))
  return <div css={css.row}>{children}</div>
}
