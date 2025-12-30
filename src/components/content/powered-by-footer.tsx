import { TfrIcon } from '@/lib/asset'
import { useTranslation } from '@/lib/locale'
import { useCss } from '@/lib/theme'

export function PoweredByFooter() {
  const { t } = useTranslation()
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
      marginTop: '24px',
      fontSize: '12px',
    },
    footerPoweredBy: {
      fontSize: '12px',
    },
    footerIcon: {
      width: '20px',
      height: '20px',
    },
    footerTfr: {
      fontSize: '12px',
    },
  }))
  return (
    <div css={css.footer}>
      <span css={css.footerPoweredBy}>{t('powered_by')}</span>
      <TfrIcon css={css.footerIcon} />
      <span css={css.footerTfr}>{t('the_fitting_room')}</span>
    </div>
  )
}
