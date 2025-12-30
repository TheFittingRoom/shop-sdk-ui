import { forwardRef } from 'react'
import { CSSObject } from '@emotion/react'

export type ButtonVariant = 'primary'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant: ButtonVariant
  css?: CSSObject
}

const VARIANT_CSS: Record<ButtonVariant, CSSObject> = {
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
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ children, variant, css, ...props }, ref) => {
    return (
      <button ref={ref} css={[VARIANT_CSS[variant], css]} {...props}>
        {children}
      </button>
    )
  },
)
Button.displayName = 'Button'
