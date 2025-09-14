export interface SizeRecTableRowProps {
  location: string
  fit: string
  isPerfect?: boolean
  isRecommended?: boolean
}

export const SizeRecTableRow = ({ location, fit, isPerfect = false, isRecommended = false }: SizeRecTableRowProps) => {
  const rightCellClass = `tfr-size-rec-table-cell-right${isPerfect ? ' perfect' : ''}${isRecommended ? ' recommended' : ''}`

  return (
    <div className="tfr-size-rec-table-row">
      <div className="tfr-size-rec-table-cell-left">{location}</div>
      <div className={rightCellClass}>{fit}</div>
    </div>
  )
}
