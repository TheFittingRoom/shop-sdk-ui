import { ResolvedFittingRoomItem } from '@/lib/fitting-room-data'
import { useCss } from '@/lib/theme'
import { DetailAccordionItem, DetailMode, Platform } from './detail-accordion-item'

interface DetailAccordionProps {
  items: ResolvedFittingRoomItem[]
  openItemExternalId: string | null
  platform: Platform
  detailMode: DetailMode
  isMobileQuickRow: boolean
  forceUntuck: boolean
  onOpenItem: (externalId: string | null) => void
  onChangeDetailMode: (mode: DetailMode) => void
  onChangeSize: (externalId: string, sizeLabel: string) => void
  onAddToCart: (externalId: string) => void
  onToggleUntuck: () => void
}

// DetailAccordion lays out the per-item rows for the currently-selected items.
// Single-open semantics — tapping the open item's header closes it; tapping a
// closed item closes any other and opens this one.
export function DetailAccordion({
  items,
  openItemExternalId,
  platform,
  detailMode,
  isMobileQuickRow,
  forceUntuck,
  onOpenItem,
  onChangeDetailMode,
  onChangeSize,
  onAddToCart,
  onToggleUntuck,
}: DetailAccordionProps) {
  const css = useCss((_theme) => ({
    container: {
      display: 'flex',
      flexDirection: 'column',
    },
  }))
  return (
    <div css={css.container}>
      {items.map((item) => {
        const isOpen = openItemExternalId === item.externalId
        return (
          <DetailAccordionItem
            key={item.externalId}
            item={item}
            isOpen={isOpen}
            platform={platform}
            detailMode={detailMode}
            isMobileQuickRow={isMobileQuickRow}
            forceUntuck={forceUntuck}
            onToggleOpen={() => onOpenItem(isOpen ? null : item.externalId)}
            onChangeDetailMode={onChangeDetailMode}
            onChangeSize={(label) => onChangeSize(item.externalId, label)}
            onAddToCart={() => onAddToCart(item.externalId)}
            onToggleUntuck={onToggleUntuck}
          />
        )
      })}
    </div>
  )
}
