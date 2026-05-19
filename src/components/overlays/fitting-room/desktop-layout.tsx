import { useLayoutEffect, useRef, useState } from 'react'
import { LinkT } from '@/components/link'
import { TfrIcon } from '@/lib/asset'
import type { ResolvedFittingRoom, ResolvedFittingRoomItem } from '@/lib/fitting-room-data'
import { useCss } from '@/lib/theme'
import type { Availability } from '@/lib/fitting-room-outfit'
import { AvatarControls } from './avatar-controls'
import { AvatarPane } from './avatar-pane'
import { CardRail } from './card-rail'
import { DetailAccordion } from './detail-accordion'
import type { DetailMode } from './detail-accordion-item'
import { ZoomModal } from '@/components/zoom-modal'

// Avatar frames are rendered at portrait 2:3 (width:height). We size the
// avatar column by computing width = available height * (2/3); the details
// and rails columns then split what's left.
const AVATAR_ASPECT_RATIO = 2 / 3
// Edge inset for the detail and rails columns. The avatar column has no
// inset — it sits flush to the overlay's top, left and bottom edges.
const EDGE_INSET_PX = 16
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
  // The outfit has something to tuck into — computed in FittingRoomOverlay.
  canTuck: boolean
  frameUrls: string[] | null
  onSelectItem: (externalId: string) => void
  onRemoveItem: (externalId: string) => void
  onOpenAccordionItem: (externalId: string | null) => void
  onChangeDetailMode: (mode: DetailMode) => void
  onChangeSize: (externalId: string, sizeLabel: string) => void
  onAddToCart: (externalId: string) => void
  onToggleUntuck: () => void
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
  canTuck,
  frameUrls,
  onSelectItem,
  onRemoveItem,
  onOpenAccordionItem,
  onChangeDetailMode,
  onChangeSize,
  onAddToCart,
  onToggleUntuck,
  onSignOut,
}: DesktopLayoutProps) {
  const hasSelection = selectedItems.length > 0
  // Avatar-pane hover collapses the AvatarControls pills to icon-only when
  // the cursor isn't over the image pane.
  const [avatarHovered, setAvatarHovered] = useState<boolean>(false)
  // Zoom modal open state, and the avatar frame index lifted from AvatarPane
  // so the zoom modal can show whichever frame is currently displayed.
  const [zoomOpen, setZoomOpen] = useState<boolean>(false)
  const [selectedFrameIndex, setSelectedFrameIndex] = useState<number | null>(null)

  // Measure container height so we can derive a width for the avatar column
  // that matches the portrait frame aspect (mirrors what quick-view's Avatar
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
      // The grid container has no padding — the avatar cell spans the full
      // overlay height, flush to the top and bottom edges.
      const availableHeightPx = el.clientHeight
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
  const gridTemplateColumns = hasSelection
    ? `${avatarWidth}px minmax(${DETAILS_MIN_WIDTH_PX}px, ${DETAILS_FR}fr) ${CARDS_FR}fr`
    : `${avatarWidth}px 1fr`

  const css = useCss((_theme) => ({
    container: {
      display: 'grid',
      gap: '16px',
      width: '100%',
      height: '100%',
      // No padding — the avatar column sits flush to the overlay's top,
      // left and bottom edges. The detail and rails columns carry their own
      // edge insets instead.
      padding: 0,
      boxSizing: 'border-box',
      overflow: 'hidden',
    },
    avatarColumn: {
      minWidth: 0,
      minHeight: 0,
    },
    // detail/rails paddingTop values are tuned so the first accordion title
    // ("Top") and the first card-rail header ("TOPS") sit on the same line:
    // 20 + 14 (detail header pad) == 26 + 8 (rail header pad) == 34px.
    detailColumn: {
      minWidth: 0,
      minHeight: 0,
      overflowY: 'auto',
      padding: `20px 8px ${EDGE_INSET_PX}px`,
    },
    railsColumn: {
      position: 'relative',
      minWidth: 0,
      minHeight: 0,
      overflowY: 'auto',
      display: 'flex',
      flexDirection: 'column',
      gap: '24px',
      padding: `26px ${EDGE_INSET_PX}px ${EDGE_INSET_PX}px 8px`,
    },
    // Sign-out is overlaid on the top-right corner of the rails column so it
    // shares a row with the first card-rail header rather than reserving its
    // own row. It scrolls away with the content, which is fine — it only
    // needs to overlap that first header.
    signOutWrapper: {
      position: 'absolute',
      // Near the overlay top, partially overlapping the first card-rail
      // header row below it.
      top: '15px',
      right: '24px',
      zIndex: 3,
      display: 'inline-flex',
      alignItems: 'center',
      gap: '8px',
      cursor: 'pointer',
      color: _theme.color_tfr_800,
    },
    signOutIcon: {
      width: '12px',
      height: '22px',
      fill: _theme.color_tfr_800,
      flex: 'none',
    },
    signOut: {
      color: _theme.color_tfr_800,
      fontSize: '14px',
    },
  }))

  const controls = hasSelection ? (
    <AvatarControls
      selectedItems={selectedItems}
      canTuck={canTuck}
      forceUntuck={forceUntuck}
      zoomed={zoomOpen}
      expanded={avatarHovered}
      onToggleUntuck={onToggleUntuck}
      onToggleZoom={() => setZoomOpen(true)}
      onRemoveItem={onRemoveItem}
    />
  ) : null

  return (
    <div ref={containerRef} css={css.container} style={{ gridTemplateColumns }}>
      <div
        css={css.avatarColumn}
        onMouseEnter={() => setAvatarHovered(true)}
        onMouseLeave={() => setAvatarHovered(false)}
      >
        <AvatarPane
          hasSelection={hasSelection}
          frameUrls={frameUrls}
          controls={controls}
          selectedFrameIndex={selectedFrameIndex}
          setSelectedFrameIndex={setSelectedFrameIndex}
        />
      </div>
      {hasSelection ? (
        <div css={css.detailColumn}>
          <DetailAccordion
            items={selectedItems}
            openItemExternalId={openAccordionItemId}
            platform="desktop"
            detailMode={detailMode}
            isMobileQuickRow={false}
            forceUntuck={forceUntuck}
            canTuck={canTuck}
            onOpenItem={onOpenAccordionItem}
            onChangeDetailMode={onChangeDetailMode}
            onChangeSize={onChangeSize}
            onAddToCart={onAddToCart}
            onToggleUntuck={onToggleUntuck}
          />
        </div>
      ) : null}
      <div css={css.railsColumn}>
        <span css={css.signOutWrapper} onClick={onSignOut}>
          <TfrIcon css={css.signOutIcon} />
          <LinkT variant="underline" css={css.signOut} t="fitting_room.sign_out" />
        </span>
        {resolved.groups.map((group) => (
          <CardRail
            key={group.group.name}
            group={group}
            availabilityByExternalId={availabilityByExternalId}
            onSelectItem={onSelectItem}
            onRemoveItem={onRemoveItem}
          />
        ))}
      </div>
      {zoomOpen && frameUrls && frameUrls.length > 0 ? (
        <ZoomModal
          frameUrls={frameUrls}
          selectedFrameIndex={selectedFrameIndex}
          setSelectedFrameIndex={setSelectedFrameIndex}
          onClose={() => setZoomOpen(false)}
        />
      ) : null}
    </div>
  )
}
