import { TfrIcon } from '@/lib/asset'
import { useTranslation } from '@/lib/locale'
import { useStyles } from '@/lib/theme'

export function PoweredByFooter() {
  const { t } = useTranslation()
  const styles = useStyles((_theme) => ({
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
    <div style={styles.footer}>
      <span style={styles.footerPoweredBy}>{t('powered_by')}</span>
      <TfrIcon style={styles.footerIcon} />
      <span style={styles.footerTfr}>{t('the_fitting_room')}</span>
    </div>
  )
}
