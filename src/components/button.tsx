import { forwardRef } from 'react'
import { useTranslation } from '@/lib/locale'
import { CssProperties, useVariantCss } from '@/lib/theme'

export type ButtonVariant = 'base' | 'primary' | 'brand'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant: ButtonVariant
  css?: CssProperties
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ children, variant, css, ...props }, ref) => {
    const variantCss = useVariantCss<ButtonVariant>(variant, (theme) => ({
      base: {
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        textAlign: 'center',
        fontFamily: theme.font_family,
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
        fontFamily: theme.font_family,
        fontSize: '16px',
        fontWeight: 'bold',
        textAlign: 'center',
      },
      brand: {
        display: 'block',
        width: '100%',
        backgroundColor: theme.brand_button_background_color,
        color: theme.brand_button_text_color,
        border: 'none',
        borderRadius: '25px',
        padding: '16px 24px',
        cursor: 'pointer',
        fontFamily: theme.font_family,
        fontSize: '14px',
        fontWeight: '500',
        textAlign: 'center',
        textTransform: 'uppercase',
        letterSpacing: '0.75px',
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
