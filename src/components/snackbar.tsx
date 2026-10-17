import { useEffect } from 'react'
import { Text, TextT } from '@/components/text'
import { useTranslation } from '@/lib/locale'
import { useCss } from '@/lib/theme'

export interface SnackbarProps {
  // i18n key for the message text.
  messageKey: string
  // Interpolation values for messageKey.
  messageVars?: Record<string, string>
  // Optional second line of plain text under the message — e.g. the store's
  // own reason a cart add failed. Not translated: it comes from elsewhere.
  detail?: string | null
  // 'error' (default) is the dark pill. 'info' is TFR teal, for notices about
  // something the SDK did on the shopper's behalf, so it never reads as a
  // failure.
  variant?: 'error' | 'info'
  // An inline link-style action after the message, e.g. Undo.
  action?: { labelKey: string; onClick: () => void }
  // Close on its own after this many ms. Remount (change `key`) to restart.
  autoDismissMs?: number
  // Distance from the bottom of the positioned ancestor, as CSS. Lets an
  // overlay lift the snackbar clear of its own bottom controls.
  bottom?: string
  onDismiss: () => void
}

// Snackbar — a dismissable pill anchored to the bottom-centre of its nearest
// positioned ancestor. Used for transient messages in the VTO overlays.
export function Snackbar({
  messageKey,
  messageVars,
  detail,
  variant = 'error',
  action,
  autoDismissMs,
  bottom = '24px',
  onDismiss,
}: SnackbarProps) {
  const { t } = useTranslation()
  const css = useCss((theme) => ({
    container: {
      position: 'absolute',
      left: '50%',
      transform: 'translateX(-50%)',
      padding: '12px 20px',
      borderRadius: '24px',
      fontSize: '13px',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      zIndex: 10,
      maxWidth: 'calc(100% - 32px)',
    },
    error: { backgroundColor: theme.color_fg_text },
    info: { backgroundColor: theme.color_tfr_800 },
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
    action: {
      background: 'none',
      border: 'none',
      padding: 0,
      color: '#FFFFFF',
      fontSize: '13px',
      fontWeight: '600',
      textDecoration: 'underline',
      whiteSpace: 'nowrap',
      cursor: 'pointer',
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

  useEffect(() => {
    if (autoDismissMs == null) {
      return
    }
    const timer = window.setTimeout(onDismiss, autoDismissMs)
    return () => window.clearTimeout(timer)
    // onDismiss is usually an inline closure; restarting the timer on every
    // parent render would keep the snackbar up indefinitely.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoDismissMs])

  return (
    // `bottom` is applied outside useCss, which computes once per mount: the
    // fitting room switches it between layouts while a snackbar can be up.
    <div css={[css.container, css[variant], { bottom }]} role={variant === 'info' ? 'status' : 'alert'}>
      <div css={css.lines}>
        <TextT variant="base" t={messageKey} vars={messageVars} css={css.text} />
        {detail ? (
          <Text variant="base" css={css.detail}>
            {detail}
          </Text>
        ) : null}
      </div>
      {action ? (
        <button css={css.action} onClick={action.onClick}>
          {t(action.labelKey)}
        </button>
      ) : null}
      <button css={css.dismiss} onClick={onDismiss} aria-label="Dismiss">
        ×
      </button>
    </div>
  )
}
