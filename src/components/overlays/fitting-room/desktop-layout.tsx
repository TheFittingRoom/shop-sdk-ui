import { ResolvedFittingRoom, ResolvedFittingRoomItem } from '@/lib/fitting-room-data'
import { useCss } from '@/lib/theme'
import { Availability } from './availability'
import { AvatarControls } from './avatar-controls'
import { AvatarPane } from './avatar-pane'
import { CardRail } from './card-rail'
import { DetailAccordion } from './detail-accordion'
import { DetailMode } from './detail-accordion-item'

interface DesktopLayoutProps {
  resolved: ResolvedFittingRoom
  selectedItems: ResolvedFittingRoomItem[]
  availabilityByExternalId: Record<string, Availability>
  openAccordionItemId: string | null
  detailMode: DetailMode
  forceUntuck: boolean
  zoomed: boolean
  frameUrls: string[] | null
  onSelectItem: (externalId: string) => void
  onRemoveItem: (externalId: string) => void
  onOpenAccordionItem: (externalId: string | null) => void
  onChangeDetailMode: (mode: DetailMode) => void
  onChangeSize: (externalId: string, sizeLabel: string) => void
  onAddToCart: (externalId: string) => void
  onToggleUntuck: () => void
  onToggleZoom: () => void
}

// DesktopLayout. 2-column when no items selected (avatar + card rails);
// 3-column when 1+ selected (avatar + detail accordion + card rails).
export function DesktopLayout({
  resolved,
  selectedItems,
  availabilityByExternalId,
  openAccordionItemId,
  detailMode,
  forceUntuck,
  zoomed,
  frameUrls,
  onSelectItem,
  onRemoveItem,
  onOpenAccordionItem,
  onChangeDetailMode,
  onChangeSize,
  onAddToCart,
  onToggleUntuck,
  onToggleZoom,
}: DesktopLayoutProps) {
  const hasSelection = selectedItems.length > 0
  const hasTuckable = selectedItems.some((i) => i.styleCategory?.tuckable)
  const css = useCss((_theme) => ({
    container: {
      display: 'grid',
      gridTemplateColumns: zoomed ? '1fr' : hasSelection ? '1fr 360px 480px' : '1fr 600px',
      gap: '16px',
      width: '100%',
      height: '100%',
      padding: '16px',
      boxSizing: 'border-box',
      overflow: 'hidden',
    },
    avatarColumn: {
      minHeight: 0,
    },
    detailColumn: {
      minHeight: 0,
      overflowY: 'auto',
      padding: '0 8px',
    },
    railsColumn: {
      minHeight: 0,
      overflowY: 'auto',
      display: 'flex',
      flexDirection: 'column',
      gap: '24px',
      padding: '0 8px',
    },
  }))

  const controls = hasSelection ? (
    <AvatarControls
      selectedItems={selectedItems}
      hasTuckable={hasTuckable}
      forceUntuck={forceUntuck}
      zoomed={zoomed}
      onToggleUntuck={onToggleUntuck}
      onToggleZoom={onToggleZoom}
      onRemoveItem={onRemoveItem}
    />
  ) : null

  return (
    <div css={css.container}>
      <div css={css.avatarColumn}>
        <AvatarPane hasSelection={hasSelection} frameUrls={frameUrls} controls={controls} />
      </div>
      {!zoomed && hasSelection ? (
        <div css={css.detailColumn}>
          <DetailAccordion
            items={selectedItems}
            openItemExternalId={openAccordionItemId}
            detailMode={detailMode}
            isMobileQuickRow={false}
            forceUntuck={forceUntuck}
            onOpenItem={onOpenAccordionItem}
            onChangeDetailMode={onChangeDetailMode}
            onChangeSize={onChangeSize}
            onAddToCart={onAddToCart}
            onToggleUntuck={onToggleUntuck}
          />
        </div>
      ) : null}
      {!zoomed ? (
        <div css={css.railsColumn}>
          {resolved.groups.map((group) => (
            <CardRail
              key={group.group.name}
              group={group}
              availabilityByExternalId={availabilityByExternalId}
              onSelectItem={onSelectItem}
              layout="horizontal"
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}
