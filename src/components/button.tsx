import { forwardRef, ReactNode } from 'react'
import { useTranslation } from '@/lib/locale'
import { CssProp, useVariantCss } from '@/lib/theme'

export type ButtonVariant = 'base' | 'primary' | 'outline' | 'brand'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant: ButtonVariant
  css?: CssProp
  icon?: ReactNode
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ children, variant, css, icon, ...props }, ref) => {
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
        textTransform: 'uppercase',
        letterSpacing: '0.75px',
      },
      outline: {
        display: 'block',
        width: '100%',
        backgroundColor: '#fff',
        color: 'black',
        border: `2px solid ${theme.color_tfr_800}`,
        borderRadius: '25px',
        padding: '16px 24px',
        cursor: 'pointer',
        fontFamily: theme.font_family,
        fontSize: '16px',
        fontWeight: '500',
        textAlign: 'center',
        textTransform: 'uppercase',
        letterSpacing: '0.75px',
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
        {icon}
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
