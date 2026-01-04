import { useCss } from '@/lib/theme'

export function Loading() {
  const css = useCss(_theme => ({
    container: {
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100%',
    },
  }))
  return <div css={css.container}>Loading...</div>
}
