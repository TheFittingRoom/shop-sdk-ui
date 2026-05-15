import { useLayoutEffect, useRef, useState } from 'react'
import { LinkT } from '@/components/link'
import { ResolvedFittingRoom, ResolvedFittingRoomItem } from '@/lib/fitting-room-data'
import { useCss } from '@/lib/theme'
import { Availability } from './availability'
import { AvatarControls } from './avatar-controls'
import { AvatarPane } from './avatar-pane'
import { CardRail } from './card-rail'
import { DetailAccordion } from './detail-accordion'
import { DetailMode } from './detail-accordion-item'

// Avatar frames are rendered at portrait 2:3 (width:height). We size the
// avatar column by computing width = available height * (2/3); the details
// and rails columns then split what's left.
const AVATAR_ASPECT_RATIO = 2 / 3
const CONTAINER_PADDING_PX = 16
const AVATAR_MIN_WIDTH_PX = 240
const AVATAR_MAX_WIDTH_PX = 560
// Details/cards split: details has a 350px floor so the size pills + fit
// chart + CTA stay readable on narrower viewports; when there's room above
// the floor, they split the remaining space ~40/60.
const DETAILS_MIN_WIDTH_PX = 350
const DETAILS_FR = 2
const CARDS_FR = 3

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
  onSignOut: () => void
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
  onSignOut,
}: DesktopLayoutProps) {
  const hasSelection = selectedItems.length > 0
  const hasTuckable = selectedItems.some((i) => i.styleCategory?.tuckable)

  // Measure container height so we can derive a width for the avatar column
  // that matches the portrait frame aspect (mirrors what vto-single's Avatar
  // does for its sidecar layout). Without this, fixed grid columns squeeze
  // the avatar column to near-zero on narrower viewports.
  //
  // ResizeObserver (vs. a one-shot useLayoutEffect + window resize listener)
  // is necessary because the ModalFrame parent finalizes its box AFTER the
  // initial layout pass, and we need to re-measure when that lands.
  const containerRef = useRef<HTMLDivElement>(null)
  const [avatarWidth, setAvatarWidth] = useState<number>(AVATAR_MIN_WIDTH_PX)
  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver(() => {
      const availableHeightPx = el.clientHeight - CONTAINER_PADDING_PX * 2
      if (availableHeightPx <= 0) return
      const target = Math.floor(availableHeightPx * AVATAR_ASPECT_RATIO)
      setAvatarWidth(Math.min(AVATAR_MAX_WIDTH_PX, Math.max(AVATAR_MIN_WIDTH_PX, target)))
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // gridTemplateColumns must be applied as inline style — useCss memoizes its
  // result on mount and never re-derives, so dynamic values (like the resize-
  // observer-driven avatarWidth) wouldn't propagate through it.
  const gridTemplateColumns = zoomed
    ? '1fr'
    : hasSelection
      ? `${avatarWidth}px minmax(${DETAILS_MIN_WIDTH_PX}px, ${DETAILS_FR}fr) ${CARDS_FR}fr`
      : `${avatarWidth}px 1fr`

  const css = useCss((_theme) => ({
    container: {
      display: 'grid',
      gap: '16px',
      width: '100%',
      height: '100%',
      padding: `${CONTAINER_PADDING_PX}px`,
      boxSizing: 'border-box',
      overflow: 'hidden',
    },
    avatarColumn: {
      minWidth: 0,
      minHeight: 0,
    },
    detailColumn: {
      minWidth: 0,
      minHeight: 0,
      overflowY: 'auto',
      padding: '0 8px',
    },
    railsColumn: {
      minWidth: 0,
      minHeight: 0,
      overflowY: 'auto',
      display: 'flex',
      flexDirection: 'column',
      gap: '24px',
      padding: '0 8px',
    },
    railsHeader: {
      display: 'flex',
      justifyContent: 'flex-end',
      paddingBottom: '4px',
    },
    signOut: {
      fontSize: '12px',
      letterSpacing: '0.3px',
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
    <div ref={containerRef} css={css.container} style={{ gridTemplateColumns }}>
      <div css={css.avatarColumn}>
        <AvatarPane hasSelection={hasSelection} frameUrls={frameUrls} controls={controls} />
      </div>
      {!zoomed && hasSelection ? (
        <div css={css.detailColumn}>
          <DetailAccordion
            items={selectedItems}
            openItemExternalId={openAccordionItemId}
            platform="desktop"
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
          <div css={css.railsHeader}>
            <LinkT variant="underline" css={css.signOut} t="fitting_room.sign_out" onClick={onSignOut} />
          </div>
          {resolved.groups.map((group) => (
            <CardRail
              key={group.group.name}
              group={group}
              availabilityByExternalId={availabilityByExternalId}
              onSelectItem={onSelectItem}
              onRemoveItem={onRemoveItem}
              layout="horizontal"
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}
