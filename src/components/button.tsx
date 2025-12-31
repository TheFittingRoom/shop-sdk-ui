import { forwardRef } from 'react'
import { useTranslation } from '@/lib/locale'
import { CssProperties, useVariantCss } from '@/lib/theme'

export type ButtonVariant = 'base' | 'primary'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant: ButtonVariant
  css?: CssProperties
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ children, variant, css, ...props }, ref) => {
    const variantCss = useVariantCss<ButtonVariant>(variant, (theme) => ({
      base: {
        backgroundColor: 'none',
        border: 'none',
        cursor: 'pointer',
      },
      primary: {
        display: 'block',
        width: '100%',
        backgroundColor: theme.color_tfr_800,
        color: '#FFFFFF',
        border: 'none',
        borderRadius: '25px',
        padding: '16px 24px',
        cursor: 'pointer',
        fontSize: '16px',
        fontWeight: 'bold',
      },
    }))
    return (
      <button ref={ref} css={[variantCss, css]} {...props}>
        {children}
      </button>
    )
  },
)
Button.displayName = 'Button'

export interface ButtonTProps extends Omit<ButtonProps, 'children'> {
  t: string
  vars?: Record<string, string | number>
}

export function ButtonT({ t, vars, ...props }: ButtonTProps) {
  const { t: translate } = useTranslation()
  const translatedText = translate(t, vars)
  return (
    <Button {...props}>
      {translatedText}
    </Button>
  )
}
