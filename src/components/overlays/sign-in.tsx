import { useCallback, useState } from 'react'
import { TfrTitle } from '@/components/content/tfr-title'
import { Button } from '@/components/button'
import { Link } from '@/components/link'
import { ContentModal } from '@/components/modal'
import { getAuthManager } from '@/lib/firebase'
import { useTranslation } from '@/lib/locale'
import { useMainStore } from '@/lib/store'
import { useCss } from '@/lib/theme'
import { OverlayName, OverlayProps } from '@/lib/view'

export interface SignInOverlayProps extends OverlayProps {
  returnToOverlay?: OverlayName
}

export default function SignInOverlay({ returnToOverlay }: SignInOverlayProps) {
  const { t } = useTranslation()
  const closeOverlay = useMainStore((state) => state.closeOverlay)
  const openOverlay = useMainStore((state) => state.openOverlay)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const css = useCss((_theme) => ({
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
      border: '1px solid #900B09',
    },
    inputErrorMessage: {
      color: '#900B09',
      fontSize: '14px',
    },
    emailContainer: {
      marginTop: '104px',
    },
    emailErrorContainer: {
      marginTop: '4px',
      height: '18px',
    },
    passwordContainer: {
      marginTop: '16px',
    },
    passwordErrorContainer: {
      marginTop: '4px',
      height: '18px',
    },
    forgotPasswordContainer: {
      marginTop: '36px',
    },
    forgotPasswordLink: {
      fontSize: '16px',
    },
    signInButtonContainer: {
      marginTop: '28px',
    },
    noAccountContainer: {
      marginTop: '24px',
      marginLeft: 'auto',
      marginRight: 'auto',
      fontSize: '16px',
    },
    getAppLink: {
      fontSize: '16px',
    },
  }))

  const handleSubmit = useCallback(
    (event: React.FormEvent) => {
      async function loginUser(email: string, password: string) {
        try {
          const authManager = getAuthManager()
          await authManager.login(email, password)
          if (returnToOverlay) {
            openOverlay(returnToOverlay)
          } else {
            closeOverlay()
          }
        } catch (error) {
          console.error('[TFR] Login failed:', error)
          setEmailError(' ')
          setPasswordError(t('sign-in.login_failed'))
          passwordEl.focus()
        }
      }
      event.preventDefault()
      const formEl = event.target as HTMLFormElement
      const emailEl = formEl.elements.namedItem('email') as HTMLInputElement
      const passwordEl = formEl.elements.namedItem('password') as HTMLInputElement
      let emailError: string | null = null
      let passwordError: string | null = null
      if (!emailEl.validity.valid) {
        emailError = t('sign-in.invalid_email')
      }
      if (!passwordEl.validity.valid) {
        passwordError = t('sign-in.missing_password')
      }
      setEmailError(emailError)
      setPasswordError(passwordError)
      if (emailError) {
        emailEl.focus()
        return
      }
      if (passwordError) {
        passwordEl.focus()
        return
      }

      const email = emailEl.value
      const password = passwordEl.value
      loginUser(email, password)
    },
    [returnToOverlay, closeOverlay, openOverlay, t],
  )
  const handleForgotPasswordClick = useCallback(() => {
    openOverlay(OverlayName.FORGOT_PASSWORD, { returnToOverlay })
  }, [returnToOverlay])
  const handleGetAppClick = useCallback(() => {
    openOverlay(OverlayName.GET_APP, { returnToOverlay })
  }, [returnToOverlay])

  return (
    <ContentModal onRequestClose={closeOverlay} title={<TfrTitle />}>
      <form onSubmit={handleSubmit} css={css.form}>
        <div css={css.emailContainer}>
          <input
            name="email"
            type="email"
            placeholder={t('sign-in.email')}
            required
            css={{ ...css.input, ...(emailError ? css.inputError : {}) }}
          />
        </div>
        <div css={css.emailErrorContainer}>{emailError && <span css={css.inputErrorMessage}>{emailError}</span>}</div>
        <div css={css.passwordContainer}>
          <input
            name="password"
            type="password"
            placeholder={t('sign-in.password')}
            required
            css={{ ...css.input, ...(passwordError ? css.inputError : {}) }}
          />
        </div>
        <div css={css.passwordErrorContainer}>
          {passwordError && <span css={css.inputErrorMessage}>{passwordError}</span>}
        </div>
        <div css={css.forgotPasswordContainer}>
          <Link onClick={handleForgotPasswordClick} variant="underline" css={css.forgotPasswordLink}>
            {t('sign-in.forgot_password')}
          </Link>
        </div>
        <div css={css.signInButtonContainer}>
          <Button type="submit" variant="primary">
            {t('sign-in.sign_in')}
          </Button>
        </div>
        <div css={css.noAccountContainer}>
          {t('sign-in.no_account')}{' '}
          <Link onClick={handleGetAppClick} variant="semibold" css={css.getAppLink}>
            {t('sign-in.download_app')}
          </Link>
        </div>
      </form>
    </ContentModal>
  )
}
