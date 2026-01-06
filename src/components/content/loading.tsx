import { TextT } from '@/components/text'
import { LoadingCircleIcon } from '@/lib/asset'
import { keyframes, useCss } from '@/lib/theme'

export interface LoadingProps {
  t?: string
}

export function Loading({ t = 'loading' }: LoadingProps) {
  const css = useCss((_theme) => {
    const spin = keyframes({
      from: { transform: 'rotate(0deg)' },
      to: { transform: 'rotate(360deg)' },
    })
    return {
      container: {
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100%',
        gap: '4px',
      },
      icon: {
        width: '76px',
        height: '76px',
        animation: `${spin} 2s linear infinite`,
      },
      text: {},
    }
  })
  return (
    <div css={css.container}>
      <LoadingCircleIcon css={css.icon} />
      <TextT variant="base" css={css.text} t={t} />
    </div>
  )
}
