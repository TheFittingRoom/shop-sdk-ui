import { TextT } from '@/components/text'
import { useIsDemoAvatar } from '@/lib/demo-avatar'
import { useCss } from '@/lib/theme'

// DemoWatermark marks a try-on image as rendered on the demo avatar, not the
// shopper's own body, so nobody mistakes the fit for theirs. Place it inside
// the positioned box that holds the frame image; it covers the box, ignores
// pointer events (drag-to-rotate and pinch still reach the image), and
// renders nothing for a shopper with their own avatar.
export function DemoWatermark() {
  const isDemo = useIsDemoAvatar()
  const css = useCss((_theme) => ({
    container: {
      position: 'absolute',
      inset: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      pointerEvents: 'none',
      overflow: 'hidden',
    },
    text: {
      transform: 'rotate(-30deg)',
      fontSize: '40px',
      fontWeight: '700',
      letterSpacing: '6px',
      textTransform: 'uppercase',
      whiteSpace: 'nowrap',
      // Readable on light and dark garments alike without hiding them.
      color: 'rgba(255, 255, 255, 0.55)',
      textShadow: '0 0 6px rgba(0, 0, 0, 0.35)',
      userSelect: 'none',
    },
  }))
  if (!isDemo) {
    return null
  }
  return (
    <div css={css.container} data-testid="demo-watermark">
      <TextT variant="base" css={css.text} t="mini_me.demo_watermark" />
    </div>
  )
}
