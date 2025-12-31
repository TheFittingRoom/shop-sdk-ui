import { ReactNode, useCallback, useRef, useState } from 'react'
import { ButtonT } from '@/components/button'
import { LinkT } from '@/components/link'
import { ContentModal } from '@/components/modal'
import { Text, TextT } from '@/components/text'
import { getAuthManager } from '@/lib/firebase'
import { useTranslation } from '@/lib/locale'
import { useMainStore } from '@/lib/store'
import { useCss } from '@/lib/theme'
import { OverlayName, OverlayProps } from '@/lib/view'

const CONTACT_US_LINK = 'mailto:info@thefittingroom.tech?subject=Forgot%20Password%20Assistance'

export interface ForgotPasswordOverlayProps extends OverlayProps {
  returnToOverlay?: OverlayName
}

export default function ForgotPasswordOverlay({ returnToOverlay }: ForgotPasswordOverlayProps) {
  const { t } = useTranslation()
  const closeOverlay = useMainStore((state) => state.closeOverlay)
  const openOverlay = useMainStore((state) => state.openOverlay)
  const emailInputRef = useRef<HTMLInputElement>(null)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [linkSent, setLinkSent] = useState(false)
  const css = useCss((theme) => ({
    titleText: {
      fontSize: '20px',
    },
    form: {
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      gap: '0',
    },
    input: {
      width: '100%',
      padding: '12px 16px',
      border: '1px solid #767676',
      borderRadius: '8px',
      fontSize: '16px',
    },
    inputError: {
      border: `1px solid ${theme.color_danger}`,
    },
    descriptionContainer: {
      marginTop: '48px',
      textAlign: 'center',
    },
    linkSentContainer: {
      marginTop: '48px',
      height: '48px',
      padding: '8px 16px',
      boxShadow: '0 4px 8px 0 rgba(0, 0, 0, 0.2), 0 6px 20px 0 rgba(0, 0, 0, 0.19)',
    },
    linkSentText: {
      color: theme.color_tfr_800,
    },
    emailContainer: {
      marginTop: '48px',
    },
    emailErrorContainer: {
      marginTop: '4px',
      height: '18px',
    },
    submitButtonContainer: {
      marginTop: '64px',
    },
    contactContainer: {
      marginTop: '32px',
    },
  }))

  const handleSubmit = useCallback(
    (event: React.FormEvent) => {
      async function resetUserPassword(email: string) {
        try {
          const authManager = getAuthManager()
          await authManager.sendPasswordResetEmail(email)
          setLinkSent(true)
        } catch (error) {
          console.error('[TFR] Error sending password reset email:', error)
        }
      }
      event.preventDefault()
      const formEl = event.target as HTMLFormElement
      const emailEl = formEl.elements.namedItem('email') as HTMLInputElement
      let emailError: string | null = null
      if (!emailEl.validity.valid) {
        emailError = t('sign-in.invalid_email')
      }
      setEmailError(emailError)
      if (emailError) {
        emailEl.focus()
        return
      }

      const email = emailEl.value
      resetUserPassword(email)
    },
    [t],
  )
  const handleBackToSignInClick = useCallback(() => {
    openOverlay(OverlayName.SIGN_IN, { returnToOverlay })
  }, [returnToOverlay, openOverlay])
  const handleContactUsClick = useCallback(() => {
    window.open(CONTACT_US_LINK, '_blank')
  }, [])

  const titleNode = <TextT variant="base" css={css.titleText} t="forgot-password.title" />
  let descriptionNode: ReactNode
  if (linkSent) {
    descriptionNode = (
      <div css={css.linkSentContainer}>
        <TextT variant="base" css={css.linkSentText} t="forgot-password.link_sent" />
      </div>
    )
  } else {
    descriptionNode = (
      <div css={css.descriptionContainer}>
        <TextT variant="base" t="forgot-password.description" />
      </div>
    )
  }

  return (
    <ContentModal onRequestClose={closeOverlay} title={titleNode} onBackClick={handleBackToSignInClick}>
      <form css={css.form} onSubmit={handleSubmit}>
        {descriptionNode}
        <div css={css.emailContainer}>
          <input
            name="email"
            type="email"
            required
            placeholder={t('sign-in.email')}
            ref={emailInputRef}
            css={[css.input, emailError ? css.inputError : null]}
          />
        </div>
        <div css={css.emailErrorContainer}>{emailError && <Text variant="error">{emailError}</Text>}</div>
        <div css={css.submitButtonContainer}>
          <ButtonT type="submit" variant="primary" t="forgot-password.send_link" />
        </div>
        <div css={css.contactContainer}>
          <TextT variant="base" t="forgot-password.need_help" />
          &nbsp;
          <LinkT variant="semibold" t="forgot-password.contact_us" onClick={handleContactUsClick} />
        </div>
      </form>
    </ContentModal>
  )
}
