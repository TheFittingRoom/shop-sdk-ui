import { TextT } from '@/components/text'
import { useCss } from '@/lib/theme'

export interface SnackbarProps {
  // i18n key for the message text.
  messageKey: string
  onDismiss: () => void
}

// Snackbar — a dismissable dark pill anchored to the bottom-centre of its
// nearest positioned ancestor. Used for transient error messages in the VTO
// overlays.
export function Snackbar({ messageKey, onDismiss }: SnackbarProps) {
  const css = useCss((theme) => ({
    container: {
      position: 'absolute',
      left: '50%',
      bottom: '24px',
      transform: 'translateX(-50%)',
      padding: '12px 20px',
      borderRadius: '24px',
      backgroundColor: theme.color_fg_text,
      fontSize: '13px',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      zIndex: 10,
      maxWidth: 'calc(100% - 32px)',
    },
    // The Text 'base' variant carries a dark color; override it so the copy
    // is readable on the dark snackbar background.
    text: {
      color: '#FFFFFF',
    },
    dismiss: {
      background: 'none',
      border: 'none',
      color: '#FFFFFF',
      fontSize: '16px',
      lineHeight: 1,
      cursor: 'pointer',
    },
  }))
  return (
    <div css={css.container}>
      <TextT variant="base" t={messageKey} css={css.text} />
      <button css={css.dismiss} onClick={onDismiss} aria-label="Dismiss">
        ×
      </button>
    </div>
  )
}
