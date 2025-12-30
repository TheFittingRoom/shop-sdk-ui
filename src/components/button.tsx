import { forwardRef } from 'react'

export type ButtonVariant = 'primary'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant: ButtonVariant
}

const VARIANT_STYLES: Record<ButtonVariant, React.CSSProperties> = {
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
  ({ children, style, variant, ...props }, ref) => {
    return (
      <button ref={ref} css={{ ...VARIANT_STYLES[variant], ...style }} {...props}>
        {children}
      </button>
    )
  },
)
Button.displayName = 'Button'
