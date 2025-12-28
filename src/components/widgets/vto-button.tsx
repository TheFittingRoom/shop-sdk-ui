import TfrIconSvg from '@/assets/tfr-icon.svg?react'
import { useTranslation } from '@/lib/locale'
import { useMainStore } from '@/lib/store'
import { useStyles } from '@/lib/theme'
import { OverlayName, WidgetProps } from '@/lib/view'

export default function VtoButtonWidget({}: WidgetProps) {
  const openOverlay = useMainStore((state) => state.openOverlay)
  const { t } = useTranslation()
  const styles = useStyles((theme) => ({
    button: {
      marginTop: '10px',
      marginBottom: '10px',
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '10px',
      padding: '13px',
      backgroundColor: 'white',
      borderWidth: '1px',
      borderColor: theme.color_fg_text,
      borderStyle: 'solid',
      borderRadius: '30px',
      cursor: 'pointer',
    },
    icon: {
      fill: theme.color_fg_text,
    },
    text: {
      color: theme.color_fg_text,
      fontSize: '14px',
      textTransform: 'uppercase',
    },
  }))

  const openVto = () => {
    openOverlay(OverlayName.VTO_SINGLE)
  }

  return (
    <button
      type="button"
      onClick={openVto}
      style={styles.button}
    >
      <TfrIconSvg style={styles.icon} />
      <span style={styles.text}>{t('try_it_on')}</span>
    </button>
  )
}
