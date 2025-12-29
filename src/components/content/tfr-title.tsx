import { TfrIcon } from '@/lib/asset'
import { useTranslation } from '@/lib/locale'
import { useStyles } from '@/lib/theme'

export function TfrTitle() {
  const { t } = useTranslation()
  const styles = useStyles((_theme) => ({
    container: {
      display: 'flex',
      alignItems: 'center',
      gap: '0',
    },
    icon: {
      width: '24px',
      height: '24px',
      fill: '#265A64',
    },
    title: {
      fontSize: '20px',
      fontWeight: '600',
      color: '#265A64',
    },
  }))
  return (
    <div style={styles.container}>
      <TfrIcon style={styles.icon} />
      <span style={styles.title}>{t('the_fitting_room')}</span>
    </div>
  )
}
