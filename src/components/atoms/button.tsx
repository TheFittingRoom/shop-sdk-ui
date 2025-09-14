export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'link'
export type ButtonSize = 'small' | 'medium' | 'large'

interface ButtonProps {
  id?: string
  variant?: ButtonVariant
  size?: ButtonSize
  className?: string
  disabled?: boolean
  type?: 'button' | 'submit' | 'reset'
  onClick?: (event: MouseEvent) => void
  ariaLabel?: string
  ariaPressed?: boolean
  ariaExpanded?: boolean
  'tfr-element'?: string
  'data-index'?: string
  'data-size-id'?: string
  [key: string]: any
}

export const Button = ({
  id,
  variant = 'primary',
  size = 'medium',
  className = '',
  disabled = false,
  type = 'button',
  onClick,
  children,
  ariaLabel,
  ariaPressed,
  ariaExpanded,
  'tfr-element': tfrElement,
  'data-index': dataIndex,
  'data-size-id': dataSizeId,
  style,
  ...restProps
}: ButtonProps) => {
  const useOldClasses =
    className &&
    (className.includes('tfr-standard-button') ||
      className.includes('tfr-c-brand-bg') ||
      className.includes('tfr-title-font'))

  let classes = className
  if (!useOldClasses) {
    const baseClass = 'tfr-button'
    const variantClass = `tfr-button--${variant}`
    const sizeClass = `tfr-button--${size}`
    const disabledClass = disabled ? 'tfr-button--disabled' : ''
    classes = [baseClass, variantClass, sizeClass, disabledClass, className].filter(Boolean).join(' ')
  }

  return (
    <button
      id={id}
      type={type}
      className={classes}
      disabled={disabled}
      onClick={onClick}
      aria-label={ariaLabel}
      aria-pressed={ariaPressed}
      aria-expanded={ariaExpanded}
      tfr-element={tfrElement}
      data-index={dataIndex ? Number(dataIndex) : undefined}
      data-size-id={dataSizeId ? Number(dataSizeId) : undefined}
      style={style}
      {...restProps}
    >
      {children}
    </button>
  )
}
