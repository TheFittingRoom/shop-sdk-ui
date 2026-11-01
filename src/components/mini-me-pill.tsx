import { useState } from 'react'
import { Button } from '@/components/button'
import { TextT } from '@/components/text'
import { GetAppPopup } from '@/components/overlays/get-app'
import { useIsDemoAvatar } from '@/lib/demo-avatar'
import type { CssProp } from '@/lib/theme'
import { useCss } from '@/lib/theme'

interface MiniMePillProps {
  // Where the pill sits; each overlay places it (often absolutely).
  position?: CssProp
}

// MiniMePill is the "Create your Mini Me" call to action shown on the try-on
// overlays while the shopper is using the demo avatar: it opens the get-app
// content over the overlay. It renders nothing for a shopper with their own
// avatar, so overlays can place it unconditionally.
//
// Same pill shape as the fitting room's SectionNav (dark) and Clear All
// (white), filled TFR teal: it is our call to action, not a store control.
export function MiniMePill({ position }: MiniMePillProps) {
  const isDemo = useIsDemoAvatar()
  const [open, setOpen] = useState(false)
  const css = useCss((theme) => ({
    pill: {
      zIndex: 5,
      display: 'inline-flex',
      alignItems: 'center',
      padding: '6px 16px',
      borderRadius: '999px',
      backgroundColor: theme.color_tfr_800,
      border: 'none',
      cursor: 'pointer',
      fontSize: '13px',
      fontWeight: '500',
      letterSpacing: '0.5px',
      textTransform: 'uppercase',
      whiteSpace: 'nowrap',
    },
    // Text's `base` variant sets its own colour, which would otherwise win.
    text: {
      color: '#FFFFFF',
    },
  }))
  if (!isDemo) {
    return null
  }
  return (
    <>
      <Button variant="base" css={{ ...css.pill, ...position }} onClick={() => setOpen(true)}>
        <TextT variant="base" css={css.text} t="mini_me.create" />
      </Button>
      {open ? <GetAppPopup onClose={() => setOpen(false)} /> : null}
    </>
  )
}
