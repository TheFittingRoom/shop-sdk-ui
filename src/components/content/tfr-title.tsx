import { TfrNameSvg } from '@/lib/asset'
import { useCss } from '@/lib/theme'

export function TfrTitle() {
  const css = useCss((_theme) => ({
    container: {
      display: 'flex',
      alignItems: 'center',
      gap: '0',
    },
    nameIcon: {
      width: '156px',
      height: '24px',
    },
  }))
  return (
    <div css={css.container}>
      <TfrNameSvg css={css.nameIcon} />
    </div>
  )
}
