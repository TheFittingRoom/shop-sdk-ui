import { Text, TextT } from '@/components/text'
import { useCss } from '@/lib/theme'

export interface SnackbarProps {
  // i18n key for the message text.
  messageKey: string
  // Optional second line of plain text under the message — e.g. the store's
  // own reason a cart add failed. Not translated: it comes from elsewhere.
  detail?: string | null
  onDismiss: () => void
}

// Snackbar — a dismissable dark pill anchored to the bottom-centre of its
// nearest positioned ancestor. Used for transient error messages in the VTO
// overlays.
export function Snackbar({ messageKey, detail, onDismiss }: SnackbarProps) {
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
    lines: {
      display: 'flex',
      flexDirection: 'column',
      gap: '2px',
    },
    detail: {
      color: '#FFFFFF',
      opacity: 0.8,
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
      <div css={css.lines}>
        <TextT variant="base" t={messageKey} css={css.text} />
        {detail ? (
          <Text variant="base" css={css.detail}>
            {detail}
          </Text>
        ) : null}
      </div>
      <button css={css.dismiss} onClick={onDismiss} aria-label="Dismiss">
        ×
      </button>
    </div>
  )
}
