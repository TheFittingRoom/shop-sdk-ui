import { useCallback, useState } from 'react'
import { Button, ButtonT } from '@/components/button'
import { LinkT } from '@/components/link'
import { ContentModal } from '@/components/modal'
import { Text, TextT } from '@/components/text'
import { putUser } from '@/lib/api'
import { getAuthManager } from '@/lib/firebase'
import { useTranslation } from '@/lib/locale'
import { getLogger } from '@/lib/logger'
import { getStaticData, useMainStore } from '@/lib/store'
import { useCss } from '@/lib/theme'
import type { DemoGender } from '@/lib/user-avatar'
import type { OverlayProps } from '@/lib/view'
import { OverlayName } from '@/lib/view'

export interface SignUpOverlayProps extends OverlayProps {
  returnToOverlay?: OverlayName
}

const logger = getLogger('sign-up')

// Firebase's default password policy.
const MIN_PASSWORD_LENGTH = 6

type FieldErrors = Partial<Record<'email' | 'password' | 'name' | 'gender' | 'age' | 'terms', string>>

// SignUpOverlay creates an account in the SDK (WEB-25), the same account the
// mobile app creates: a Firebase account, then the account record
// (PUT /v1/users/:uid) with the name, the 18+ and terms flags, and the gender
// that picks the demo avatar the shopper tries on with until they scan.
//
// If the Firebase account is created but the account record isn't, the
// shopper is left signed in to it, and submitting again only retries the
// record — signing up again would fail with "email already in use".
export default function SignUpOverlay({ returnToOverlay }: SignUpOverlayProps) {
  const { t } = useTranslation()
  const closeOverlay = useMainStore((state) => state.closeOverlay)
  const openOverlay = useMainStore((state) => state.openOverlay)
  const [gender, setGender] = useState<DemoGender | null>(null)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [emailInUse, setEmailInUse] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const css = useCss((theme) => ({
    form: {
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
    },
    intro: {
      fontSize: '14px',
      textAlign: 'center',
      marginBottom: '16px',
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
    // Fields are spaced by their own margin, not by an always-present error
    // row: storefront themes (Shopify's Dawn among them) hide empty elements
    // with `div:empty { display: none }`, which collapsed the gaps.
    field: {
      marginBottom: '12px',
    },
    errorRow: {
      marginTop: '4px',
    },
    genderLabel: {
      fontSize: '14px',
    },
    genderButtons: {
      marginTop: '6px',
      display: 'flex',
      gap: '12px',
    },
    genderButton: {
      flex: 1,
      padding: '10px 16px',
      borderRadius: '25px',
      border: `1px solid ${theme.color_tfr_800}`,
      backgroundColor: '#FFFFFF',
      color: theme.color_tfr_800,
      fontSize: '16px',
    },
    genderButtonSelected: {
      backgroundColor: theme.color_tfr_800,
      color: '#FFFFFF',
    },
    checkboxRow: {
      marginTop: '12px',
      display: 'flex',
      alignItems: 'flex-start',
      gap: '8px',
      fontSize: '14px',
    },
    checkbox: {
      marginTop: '2px',
      flex: 'none',
    },
    externalLink: {
      color: theme.color_tfr_800,
      textDecoration: 'underline',
    },
    submitContainer: {
      marginTop: '20px',
    },
    signInContainer: {
      marginTop: '16px',
      marginLeft: 'auto',
      marginRight: 'auto',
    },
  }))

  const goToSignIn = useCallback(() => {
    openOverlay(OverlayName.SIGN_IN, { returnToOverlay })
  }, [openOverlay, returnToOverlay])

  const handleSubmit = useCallback(
    (event: React.FormEvent) => {
      event.preventDefault()
      const form = event.target as HTMLFormElement
      const field = (name: string) => form.elements.namedItem(name) as HTMLInputElement
      const email = field('email').value.trim()
      const password = field('password').value
      const fullName = field('full_name').value.trim()
      const isGte18 = field('is_gte_18').checked
      const isTosAccepted = field('is_tos_accepted').checked

      const next: FieldErrors = {}
      if (!field('email').validity.valid) {
        next.email = t('sign-in.invalid_email')
      }
      if (password.length < MIN_PASSWORD_LENGTH) {
        next.password = t('sign-up.password_too_short', { count: MIN_PASSWORD_LENGTH })
      }
      if (!fullName) {
        next.name = t('sign-up.missing_name')
      }
      if (!gender) {
        next.gender = t('sign-up.missing_gender')
      }
      if (!isGte18) {
        next.age = t('sign-up.must_be_18')
      }
      if (!isTosAccepted) {
        next.terms = t('sign-up.must_accept_terms')
      }
      setErrors(next)
      setFormError(null)
      setEmailInUse(false)
      if (Object.keys(next).length > 0 || !gender) {
        return
      }

      async function signUp(chosenGender: DemoGender) {
        setSubmitting(true)
        const authManager = getAuthManager()
        try {
          // Already signed in to this email: a previous attempt created the
          // Firebase account but not the account record.
          if (authManager.getAuthUser()?.email !== email) {
            await authManager.signUp(email, password)
          }
          await putUser({
            full_name: fullName,
            is_gte_18: isGte18,
            is_tos_accepted: isTosAccepted,
            gender: chosenGender,
          })
          // The backend gave the new account its role; fetch a token that
          // carries it.
          await authManager.getAuthToken(true)
          if (returnToOverlay) {
            openOverlay(returnToOverlay)
          } else {
            closeOverlay()
          }
        } catch (error) {
          logger.logError('Sign up failed:', { error })
          const code = (error as { code?: string } | null)?.code
          if (code === 'auth/email-already-in-use') {
            setErrors({ email: t('sign-up.email_in_use') })
            setEmailInUse(true)
          } else if (code === 'auth/invalid-email') {
            setErrors({ email: t('sign-in.invalid_email') })
          } else if (code === 'auth/weak-password') {
            setErrors({ password: t('sign-up.password_too_short', { count: MIN_PASSWORD_LENGTH }) })
          } else {
            setFormError(t('sign-up.failed'))
          }
          setSubmitting(false)
        }
      }
      void signUp(gender)
    },
    [gender, returnToOverlay, openOverlay, closeOverlay, t],
  )

  const { termsOfServiceUrl, privacyPolicyUrl } = getStaticData().config.links
  const errorRow = (message: string | undefined) =>
    message ? (
      <div css={css.errorRow}>
        <Text variant="error">{message}</Text>
      </div>
    ) : null

  return (
    <ContentModal onRequestClose={closeOverlay} title={<TextT variant="brand" t="sign-up.title" />}>
      <form onSubmit={handleSubmit} css={css.form} noValidate>
        <TextT variant="base" css={css.intro} t="sign-up.intro" />
        <div css={css.field}>
          <input
            name="email"
            type="email"
            autoComplete="email"
            placeholder={t('sign-in.email')}
            required
            css={{ ...css.input, ...(errors.email ? css.inputError : {}) }}
          />
          {errorRow(errors.email)}
        </div>
        <div css={css.field}>
          <input
            name="password"
            type="password"
            autoComplete="new-password"
            placeholder={t('sign-in.password')}
            required
            css={{ ...css.input, ...(errors.password ? css.inputError : {}) }}
          />
          {errorRow(errors.password)}
        </div>
        <div css={css.field}>
          <input
            name="full_name"
            type="text"
            autoComplete="name"
            placeholder={t('sign-up.name')}
            required
            css={{ ...css.input, ...(errors.name ? css.inputError : {}) }}
          />
          {errorRow(errors.name)}
        </div>
        <div css={css.field}>
          <div role="radiogroup" aria-label={t('sign-up.gender')}>
            <TextT variant="base" css={css.genderLabel} t="sign-up.gender" />
            <div css={css.genderButtons}>
              {(['female', 'male'] as const).map((g) => (
                <Button
                  key={g}
                  type="button"
                  role="radio"
                  aria-checked={gender === g}
                  variant="base"
                  css={{ ...css.genderButton, ...(gender === g ? css.genderButtonSelected : {}) }}
                  onClick={() => setGender(g)}
                >
                  {t(`gender.${g}`)}
                </Button>
              ))}
            </div>
          </div>
          {errorRow(errors.gender)}
        </div>
        <div css={css.field}>
          <label css={css.checkboxRow}>
            <input name="is_gte_18" type="checkbox" css={css.checkbox} />
            <TextT variant="base" t="sign-up.confirm_18" />
          </label>
          {errorRow(errors.age)}
        </div>
        <div css={css.field}>
          <label css={css.checkboxRow}>
            <input name="is_tos_accepted" type="checkbox" css={css.checkbox} />
            <span>
              <TextT variant="base" t="sign-up.accept_terms" />{' '}
              <a href={termsOfServiceUrl} target="_blank" rel="noopener noreferrer" css={css.externalLink}>
                {t('sign-up.terms_of_service')}
              </a>{' '}
              <TextT variant="base" t="sign-up.and" />{' '}
              <a href={privacyPolicyUrl} target="_blank" rel="noopener noreferrer" css={css.externalLink}>
                {t('sign-up.privacy_policy')}
              </a>
            </span>
          </label>
          {errorRow(errors.terms)}
        </div>
        {formError ? <Text variant="error">{formError}</Text> : null}
        <div css={css.submitContainer}>
          <ButtonT type="submit" variant="primary" t="sign-up.submit" disabled={submitting} />
        </div>
        <div css={css.signInContainer}>
          <TextT variant="base" t={emailInUse ? 'sign-up.email_in_use_sign_in' : 'landing.already_have_account'} />
          &nbsp;
          <LinkT onClick={goToSignIn} variant="semibold" t="landing.sign_in" />
        </div>
      </form>
    </ContentModal>
  )
}
