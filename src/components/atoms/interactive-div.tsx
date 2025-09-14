interface InteractiveDivProps {
  id?: string
  className?: string
  disabled?: boolean
  onClick?: (event: MouseEvent) => void
  ariaLabel?: string
  ariaPressed?: boolean
  ariaExpanded?: boolean
  'tfr-element'?: string
  'data-index'?: string | number
  'data-size-id'?: string | number
  style?: any
  [key: string]: any
}

export const InteractiveDiv = ({
  id,
  className = '',
  disabled = false,
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
}: InteractiveDivProps) => {
  const handleClick = (e: MouseEvent) => {
    if (!disabled && onClick) onClick(e)
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (!disabled && onClick && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault()
      onClick(e as any)
    }
  }

  return (
    <div
      id={id}
      className={className}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabindex={disabled ? -1 : 0}
      tfr-element={tfrElement}
      data-index={dataIndex}
      data-size-id={dataSizeId}
      style={{
        ...style,
        cursor: disabled ? 'default' : 'pointer',
      }}
      {...restProps}
    >
      {children}
    </div>
  )
}
