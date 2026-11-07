import { TextT } from '@/components/text'
import { TfrNameSvg } from '@/lib/asset'
import { useCss } from '@/lib/theme'

export function PoweredByFooter() {
  const css = useCss((_theme) => ({
    footer: {
      position: 'absolute',
      bottom: '16px',
      marginLeft: 'auto',
      marginRight: 'auto',
      textAlign: 'center',
      display: 'flex',
      alignItems: 'center',
      gap: '2px',
      paddingTop: '24px',
      fontSize: '12px',
      // Nothing in it is interactive, and a fillHeight modal body runs under
      // its (empty) paddingTop: taps there must reach the body (the landing
      // screen's sign-in link), not stop on the footer.
      pointerEvents: 'none',
    },
    poweredBy: {
      fontSize: '12px',
    },
    nameIcon: {
      width: '120px',
      height: '24px',
    },
  }))
  return (
    <div css={css.footer}>
      <TextT variant="base" css={css.poweredBy} t="powered_by" />
      &nbsp;
      <TfrNameSvg css={css.nameIcon} />
    </div>
  )
}
