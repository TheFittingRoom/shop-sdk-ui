import { useCallback, useState } from 'react'
import { ButtonT } from '@/components/button'
import { ContentModal } from '@/components/modal'
import { Text, TextT } from '@/components/text'
import { chooseDemoGender } from '@/lib/demo-avatar'
import { useTranslation } from '@/lib/locale'
import { getLogger } from '@/lib/logger'
import { useCss } from '@/lib/theme'
import type { DemoGender } from '@/lib/user-avatar'

const logger = getLogger('gender-prompt')

// GenderPrompt asks a signed-in shopper with no avatar and no gender — an
// account created in the app before sign-up asked — which demo avatar to try
// on with. Choosing saves the gender (PUT /v1/users/:id/gender) and the
// overlay carries on with that demo avatar. Closing it closes the overlay:
// there is nothing to try on without a choice.
export function GenderPrompt({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)
  const css = useCss((_theme) => ({
    titleText: {
      textTransform: 'uppercase',
    },
    headerText: {
      fontSize: '28px',
      textAlign: 'center',
    },
    description: {
      marginTop: '8px',
      textAlign: 'center',
    },
    buttons: {
      marginTop: '24px',
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
    },
    error: {
      marginTop: '12px',
    },
  }))

  const choose = useCallback(async (gender: DemoGender) => {
    setSaving(true)
    setFailed(false)
    try {
      await chooseDemoGender(gender)
    } catch (error) {
      logger.logError('Failed to save the demo avatar choice', { error })
      setFailed(true)
      setSaving(false)
    }
  }, [])

  return (
    <ContentModal onRequestClose={onClose} title={<TextT variant="brand" css={css.titleText} t="try_it_on" />}>
      <TextT variant="brand" css={css.headerText} t="gender_prompt.header" />
      <TextT variant="base" css={css.description} t="gender_prompt.description" />
      <div css={css.buttons}>
        <ButtonT variant="primary" t="gender.female" disabled={saving} onClick={() => void choose('female')} />
        <ButtonT variant="primary" t="gender.male" disabled={saving} onClick={() => void choose('male')} />
      </div>
      {failed ? (
        <Text variant="error" css={css.error}>
          {t('gender_prompt.failed')}
        </Text>
      ) : null}
    </ContentModal>
  )
}
