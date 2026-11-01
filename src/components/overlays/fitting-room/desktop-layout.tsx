import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { ButtonT } from '@/components/button'
import { LinkT } from '@/components/link'
import { TfrIcon } from '@/lib/asset'
import type { VtoTuckLabel } from '@/api/gen/enums'
import type { ResolvedFittingRoom, ResolvedFittingRoomItem } from '@/lib/fitting-room-data'
import { useCss } from '@/lib/theme'
import type { Availability } from '@/lib/fitting-room-outfit'
import { AvatarControls } from './avatar-controls'
import { AvatarPane } from './avatar-pane'
import { CardRail } from './card-rail'
import { ClearAllPill } from './clear-all-pill'
import { DetailAccordion } from './detail-accordion'
import { SectionNav, useSectionNav } from './section-nav'
import { TopRightPills } from './top-right-pills'
import { MiniMePill } from '@/components/mini-me-pill'
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
// Bottom padding of the scrolling card column: room for the floating Clear
// All pill (~30px tall, inset 24px) so the last row can scroll clear of it.
const CLEAR_ALL_CLEARANCE_PX = 72

interface DesktopLayoutProps {
  resolved: ResolvedFittingRoom
  selectedItems: ResolvedFittingRoomItem[]
  availabilityByExternalId: Record<string, Availability>
  openAccordionItemId: string | null
  detailMode: DetailMode
  forceUntuck: boolean
  // The outfit has something to tuck into — computed in FittingRoomOverlay.
  canTuck: boolean
  // Which wording the tuck control uses — from the VTO response.
  tuckLabel: VtoTuckLabel
  frameUrls: string[] | null
  autoRotateTrigger: number | undefined
  onSelectItem: (externalId: string) => void
  onRemoveItem: (externalId: string) => void
  onOpenAccordionItem: (externalId: string | null) => void
  onChangeDetailMode: (mode: DetailMode) => void
  onChangeSize: (externalId: string, sizeLabel: string) => void
  onChangeColor: (externalId: string, colorLabel: string | null) => void
  onAddToCart: (externalId: string) => void
  // Add every selected item to the cart. Disabled while it runs, and while
  // the selection holds an item with no fitting size.
  onAddAllToCart: () => void
  addAllToCartDisabled: boolean
  onToggleUntuck: () => void
  onSignOut: () => void
  onClearAll: () => void
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
  tuckLabel,
  frameUrls,
  autoRotateTrigger,
  onSelectItem,
  onRemoveItem,
  onOpenAccordionItem,
  onChangeDetailMode,
  onChangeSize,
  onChangeColor,
  onAddToCart,
  onAddAllToCart,
  addAllToCartDisabled,
  onToggleUntuck,
  onSignOut,
  onClearAll,
}: DesktopLayoutProps) {
  const hasSelection = selectedItems.length > 0
  const sections = resolved.groups.map((g) => ({ name: g.group.name, label: g.group.label }))
  const sectionNav = useSectionNav(sections)
  // Avatar-pane hover collapses the AvatarControls pills to icon-only when
  // the cursor isn't over the image pane.
  const [avatarHovered, setAvatarHovered] = useState<boolean>(false)
  // Zoom modal open state, and the avatar frame index lifted from AvatarPane
  // so the zoom modal can show whichever frame is currently displayed.
  const [zoomOpen, setZoomOpen] = useState<boolean>(false)
  const [selectedFrameIndex, setSelectedFrameIndex] = useState<number | null>(null)
  // AvatarPane publishes its auto-rotate cancel here. The zoom modal shares
  // selectedFrameIndex with the pane, so rotating inside the modal has to
  // stop a rotation that is still running behind it.
  const cancelAutoRotateRef = useRef<(() => void) | null>(null)
  const cancelAutoRotate = useCallback(() => cancelAutoRotateRef.current?.(), [])

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
    if (!el) {
      return
    }
    const observer = new ResizeObserver(() => {
      // The grid container has no padding — the avatar cell spans the full
      // overlay height, flush to the top and bottom edges.
      const availableHeightPx = el.clientHeight
      if (availableHeightPx <= 0) {
        return
      }
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

  const css = useCss((theme) => ({
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
    // The detail pane doesn't scroll as a whole: every selected item's row is
    // always on screen, the open one fills the height left over and scrolls
    // inside itself (see DetailAccordion), and Add All sits at the bottom.
    // overflowY stays auto only as a fallback for a pane too short to fit the
    // collapsed rows plus the open item's minimum height.
    detailColumn: {
      minWidth: 0,
      minHeight: 0,
      overflowY: 'auto',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      padding: `20px 8px ${EDGE_INSET_PX}px`,
    },
    // TFR teal rather than the brand colour, so it reads as a different action
    // from each item's own Add to cart.
    addAllToCart: {
      backgroundColor: theme.color_tfr_800,
      color: '#FFFFFF',
      flex: 'none',
      // Pinned to the bottom of the pane even when nothing is open and the
      // collapsed rows don't fill it.
      marginTop: 'auto',
    },
    // The card pane: a box that does not scroll, holding the scrolling card
    // column and the Clear All pill floating over its bottom-right corner.
    railsPane: {
      position: 'relative',
      minWidth: 0,
      minHeight: 0,
      display: 'flex',
      flexDirection: 'column',
    },
    railsColumn: {
      flex: 1,
      minWidth: 0,
      minHeight: 0,
      overflowY: 'auto',
      display: 'flex',
      flexDirection: 'column',
      gap: '24px',
      // Extra bottom padding so the end of the list (Sign Out) can scroll
      // clear of the floating Clear All pill.
      padding: `26px ${EDGE_INSET_PX}px ${CLEAR_ALL_CLEARANCE_PX}px 8px`,
    },
    // Icon+link visual for the rails column's Sign Out action. Callers add
    // their own positioning on top.
    utilityLink: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '8px',
      cursor: 'pointer',
      color: theme.color_tfr_800,
    },
    utilityIcon: {
      width: '12px',
      height: '22px',
      fill: theme.color_tfr_800,
      flex: 'none',
    },
    utilityText: {
      color: theme.color_tfr_800,
      fontSize: '14px',
    },
    // Clear All floats bottom-right of the card pane, mirroring the mobile
    // browse view's pill. Inset a little more on the right than the cards so
    // it clears the column's scrollbar.
    clearAllPosition: {
      position: 'absolute',
      bottom: `${EDGE_INSET_PX + 8}px`,
      right: `${EDGE_INSET_PX + 8}px`,
    },
    // Sign Out sits at the bottom of the rails column, after the last card
    // rail. It scrolls with the content — visible once the shopper reaches
    // the end of their items. marginTop: auto in a flex column would only
    // help with a non-scrolling parent; here the scroll context makes a
    // top margin enough to separate it from the last rail above.
    signOutWrapper: {
      marginTop: '8px',
      justifyContent: 'center',
    },
  }))

  const controls = hasSelection ? (
    <AvatarControls
      selectedItems={selectedItems}
      canTuck={canTuck}
      tuckLabel={tuckLabel}
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
          autoRotateTrigger={autoRotateTrigger}
          cancelAutoRotateRef={cancelAutoRotateRef}
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
            tuckLabel={tuckLabel}
            onOpenItem={onOpenAccordionItem}
            onChangeDetailMode={onChangeDetailMode}
            onChangeSize={onChangeSize}
            onChangeColor={onChangeColor}
            onAddToCart={onAddToCart}
            onToggleUntuck={onToggleUntuck}
          />
          {/* Only with two or more: for one item, its own Add to cart is the
              same action. */}
          {selectedItems.length > 1 ? (
            <ButtonT
              variant="brand"
              css={css.addAllToCart}
              t="fitting_room.add_all_to_cart"
              onClick={onAddAllToCart}
              disabled={addAllToCartDisabled}
            />
          ) : null}
        </div>
      ) : null}
      <div css={css.railsPane}>
        {/* "Create your Mini Me" and the jump-to-section control, floating
            top-right over the cards as on mobile browse. The section control
            waits for the rails to finish loading (its readout would flicker as
            they appear) and needs more than one section to be useful. */}
        <TopRightPills>
          <MiniMePill />
          {!resolved.isLoading && resolved.groups.length > 1 ? (
            <SectionNav sections={sections} activeName={sectionNav.activeName} onSelect={sectionNav.scrollToSection} />
          ) : null}
        </TopRightPills>
        <div ref={sectionNav.scrollerRef} css={css.railsColumn} onScroll={sectionNav.onScroll}>
          {resolved.groups.map((group, index) => (
            <div key={group.group.name} ref={sectionNav.sectionRef(group.group.name)}>
              <CardRail
                group={group}
                availabilityByExternalId={availabilityByExternalId}
                onSelectItem={onSelectItem}
                onRemoveItem={onRemoveItem}
                onChangeColor={onChangeColor}
                sortSelectedFirst
                firstCardHelpTip={index === 0 && !resolved.isLoading}
              />
            </div>
          ))}
          <span css={{ ...css.utilityLink, ...css.signOutWrapper }} onClick={onSignOut}>
            <TfrIcon css={css.utilityIcon} />
            <LinkT variant="underline" css={css.utilityText} t="fitting_room.sign_out" />
          </span>
        </div>
        <ClearAllPill onClick={onClearAll} position={css.clearAllPosition} />
      </div>
      {zoomOpen && frameUrls && frameUrls.length > 0 ? (
        <ZoomModal
          frameUrls={frameUrls}
          selectedFrameIndex={selectedFrameIndex}
          setSelectedFrameIndex={setSelectedFrameIndex}
          onClose={() => setZoomOpen(false)}
          onUserInteract={cancelAutoRotate}
        />
      ) : null}
    </div>
  )
}
