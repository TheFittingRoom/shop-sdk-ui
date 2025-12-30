import { forwardRef } from 'react'
import { CssProperties, useVariantCss } from '@/lib/theme'

export type ButtonVariant = 'primary'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant: ButtonVariant
  css?: CssProperties
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ children, variant, css, ...props }, ref) => {
    const variantCss = useVariantCss<ButtonVariant>(variant, (_theme) => ({
      primary: {
        display: 'block',
        width: '100%',
        backgroundColor: '#265A64',
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
