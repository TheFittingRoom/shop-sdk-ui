import { useCallback, useRef, useState } from 'react'
import { TfrTitle } from '@/components/content/tfr-title'
import { Button } from '@/components/button'
import { ContentModal } from '@/components/modal'
import { getAuthManager } from '@/lib/firebase'
import { useTranslation } from '@/lib/locale'
import { useMainStore } from '@/lib/store'
import { useStyles } from '@/lib/theme'
import { OverlayName, OverlayProps } from '@/lib/view'

export interface SignInOverlayProps extends OverlayProps {
  returnToOverlay?: OverlayName
}

export default function SignInOverlay({ returnToOverlay }: SignInOverlayProps) {
  const { t } = useTranslation()
  const closeOverlay = useMainStore((state) => state.closeOverlay)
  const openOverlay = useMainStore((state) => state.openOverlay)
  const emailInputRef = useRef<HTMLInputElement>(null)
  const passwordInputRef = useRef<HTMLInputElement>(null)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const styles = useStyles((theme) => ({
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
      color: theme.color_fg_text,
      cursor: 'pointer',
      fontSize: '16px',
      textDecoration: 'underline',     
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
      color: theme.color_fg_text,
      cursor: 'pointer',
      fontSize: '16px',
      fontWeight: '500',
      textDecoration: 'none',
    },
  }))

  const handleSubmit = useCallback((event: React.FormEvent) => {
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

    const email = emailEl.value.trim()
    const password = passwordEl.value
    loginUser(email, password)
  }, [returnToOverlay, closeOverlay, openOverlay, t])
  const handleForgotPasswordClick = useCallback(() => {
    // Handle forgot password logic here
  }, [])
  const handleGetAppClick = useCallback(() => {
    openOverlay(OverlayName.GET_APP, { returnToOverlay })
  }, [returnToOverlay])

  return (
    <ContentModal
      onRequestClose={closeOverlay}
      title={<TfrTitle />}
    >
      <form onSubmit={handleSubmit} style={styles.form}>
        <div style={styles.emailContainer}>
          <input ref={emailInputRef} name="email" type="email" placeholder={t('sign-in.email')} required style={{ ...styles.input, ...(emailError ? styles.inputError : {}) }} />
        </div>
        <div style={styles.emailErrorContainer}>
          {emailError && <span style={styles.inputErrorMessage}>{emailError}</span>}
        </div>
        <div style={styles.passwordContainer}>
          <input ref={passwordInputRef} name="password" type="password" placeholder={t('sign-in.password')} required style={{ ...styles.input, ...(passwordError ? styles.inputError : {}) }} />
        </div>
        <div style={styles.passwordErrorContainer}>
          {passwordError && <span style={styles.inputErrorMessage}>{passwordError}</span>}
        </div>
        <div style={styles.forgotPasswordContainer}>
          <a href="#" onClick={handleForgotPasswordClick} style={styles.forgotPasswordLink}>{t('sign-in.forgot_password')}</a>
        </div>
        <div style={styles.signInButtonContainer}>
          <Button type="submit" variant="primary">{t('sign-in.sign_in')}</Button>
        </div>
        <div style={styles.noAccountContainer}>
          {t('sign-in.no_account')} <a href="#" onClick={handleGetAppClick} style={styles.getAppLink}>{t('sign-in.download_app')}</a>
        </div>
      </form>
    </ContentModal>
  )
}
