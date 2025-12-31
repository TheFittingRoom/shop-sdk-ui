import { TfrNameSvg } from '@/lib/asset'
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
      <span css={css.poweredBy}>{t('powered_by')}</span>&nbsp;<TfrNameSvg css={css.nameIcon} />
    </div>
  )
}
