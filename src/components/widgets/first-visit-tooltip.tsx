import { Text } from '@/components/text'
import { CloseIcon } from '@/lib/asset'
import { useTranslation } from '@/lib/locale'
import { useCss } from '@/lib/theme'

interface FirstVisitTooltipProps {
  onDismiss: () => void
}

// Tooltip anchored beneath the fitting-room icon, shown once per browser
// (first time the icon mounts; dismissed by click on icon, close button, or
// click outside — see fitting-room-icon.tsx for the dismiss wiring).
export function FirstVisitTooltip({ onDismiss }: FirstVisitTooltipProps) {
  const { t } = useTranslation()
  const css = useCss((theme) => ({
    wrapper: {
      position: 'absolute',
      top: '100%',
      right: 0,
      marginTop: '12px',
      width: '240px',
      zIndex: 2147483645,
      fontFamily: theme.font_family,
    },
    arrow: {
      position: 'absolute',
      top: '-7px',
      right: '14px',
      width: 0,
      height: 0,
      borderLeft: '8px solid transparent',
      borderRight: '8px solid transparent',
      borderBottom: `8px solid ${theme.color_fg_text}`,
    },
    body: {
      backgroundColor: theme.color_fg_text,
      color: '#FFFFFF',
      padding: '12px 14px',
      borderRadius: '8px',
      boxShadow: '0 6px 20px rgba(0, 0, 0, 0.18)',
      display: 'flex',
      alignItems: 'flex-start',
      gap: '8px',
    },
    text: {
      flex: 1,
      fontSize: '13px',
      lineHeight: '1.4',
      color: '#FFFFFF',
    },
    closeBtn: {
      width: '20px',
      height: '20px',
      borderRadius: '10px',
      border: 'none',
      backgroundColor: 'transparent',
      color: '#FFFFFF',
      cursor: 'pointer',
      padding: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flex: 'none',
    },
    closeIcon: {
      width: '10px',
      height: '10px',
      color: '#FFFFFF',
    },
  }))

  return (
    <div css={css.wrapper} role="dialog" aria-label={t('first_visit_tooltip.body')}>
      <div css={css.arrow} />
      <div css={css.body}>
        <Text variant="base" css={css.text}>
          {t('first_visit_tooltip.body')}
        </Text>
        <button css={css.closeBtn} onClick={onDismiss} aria-label={t('first_visit_tooltip.dismiss')}>
          <CloseIcon css={css.closeIcon} />
        </button>
      </div>
    </div>
  )
}
