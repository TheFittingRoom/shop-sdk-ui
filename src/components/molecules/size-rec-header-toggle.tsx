import { InteractiveDiv } from '@atoms/interactive-div'

interface SizeRecHeaderToggleProps {
  collapsed: boolean
  onToggle: () => void
}

export const SizeRecHeaderToggle = ({ collapsed, onToggle }: SizeRecHeaderToggleProps) => {
  const chevronClass = collapsed ? 'tfr-chevron-down' : 'tfr-chevron-up'

  return (
    <InteractiveDiv
      id="tfr-size-rec-title-toggle"
      className={chevronClass}
      onClick={onToggle}
      ariaLabel={collapsed ? 'Expand size recommendations' : 'Collapse size recommendations'}
      ariaExpanded={!collapsed}
    >
      v
    </InteractiveDiv>
  )
}
