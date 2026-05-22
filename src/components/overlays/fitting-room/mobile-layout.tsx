import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Button, ButtonT } from '@/components/button'
import { Text } from '@/components/text'
import type { ResolvedFittingRoom, ResolvedFittingRoomItem } from '@/lib/fitting-room-data'
import { DragHandleIcon, LeftArrowIcon } from '@/lib/asset'
import type { SheetSnap } from '@/lib/use-mobile-sheet-snap'
import type { StyleProp } from '@/lib/theme'
import { useCss } from '@/lib/theme'
import type { Availability } from '@/lib/fitting-room-outfit'
import { AvatarPane } from './avatar-pane'
import { MobileTuckControl } from './avatar-controls'
import { CardRail } from './card-rail'
import { DetailAccordion } from './detail-accordion'
import type { DetailMode } from './detail-accordion-item'
import { SectionNav } from './section-nav'

export type MobileMode = 'browse' | 'try-on'

// When jumping to a section, stop this far short of the very top so the
// floating section-nav pill doesn't sit over the section title.
const SECTION_SCROLL_TOP_GAP_PX = 50

interface MobileLayoutProps {
  mode: MobileMode
  resolved: ResolvedFittingRoom
  selectedItems: ResolvedFittingRoomItem[]
  availabilityByExternalId: Record<string, Availability>
  openAccordionItemId: string | null
  detailMode: DetailMode
  forceUntuck: boolean
  // The outfit has something to tuck into — computed in FittingRoomOverlay.
  canTuck: boolean
  frameUrls: string[] | null
  sheetSnap: SheetSnap
  sheetTouchStart: (e: React.TouchEvent<HTMLElement>) => void
  onSelectItem: (externalId: string) => void
  onRemoveItem: (externalId: string) => void
  onTryItOn: () => void
  onBackToBrowse: () => void
  onOpenAccordionItem: (externalId: string | null) => void
  onChangeDetailMode: (mode: DetailMode) => void
  onChangeSize: (externalId: string, sizeLabel: string) => void
  onChangeColor: (externalId: string, colorLabel: string | null) => void
  onAddToCart: (externalId: string) => void
  onToggleUntuck: () => void
}

// MobileLayout switches between two view modes inside the same overlay:
// - 'browse': 2-col card grid by category + sticky bottom TRY IT ON CTA.
// - 'try-on': fullscreen avatar pane + 3-snap bottom sheet over it.
export function MobileLayout({
  mode,
  resolved,
  selectedItems,
  availabilityByExternalId,
  openAccordionItemId,
  detailMode,
  forceUntuck,
  canTuck,
  frameUrls,
  sheetSnap,
  sheetTouchStart,
  onSelectItem,
  onRemoveItem,
  onTryItOn,
  onBackToBrowse,
  onOpenAccordionItem,
  onChangeDetailMode,
  onChangeSize,
  onChangeColor,
  onAddToCart,
  onToggleUntuck,
}: MobileLayoutProps) {
  if (mode === 'browse') {
    return (
      <BrowseView
        resolved={resolved}
        availabilityByExternalId={availabilityByExternalId}
        selectedCount={selectedItems.length}
        onSelectItem={onSelectItem}
        onRemoveItem={onRemoveItem}
        onTryItOn={onTryItOn}
      />
    )
  }
  return (
    <TryOnView
      selectedItems={selectedItems}
      openAccordionItemId={openAccordionItemId}
      detailMode={detailMode}
      forceUntuck={forceUntuck}
      canTuck={canTuck}
      frameUrls={frameUrls}
      sheetSnap={sheetSnap}
      sheetTouchStart={sheetTouchStart}
      onBackToBrowse={onBackToBrowse}
      onOpenAccordionItem={onOpenAccordionItem}
      onChangeDetailMode={onChangeDetailMode}
      onChangeSize={onChangeSize}
      onChangeColor={onChangeColor}
      onAddToCart={onAddToCart}
      onToggleUntuck={onToggleUntuck}
    />
  )
}

function BrowseView({
  resolved,
  availabilityByExternalId,
  selectedCount,
  onSelectItem,
  onRemoveItem,
  onTryItOn,
}: {
  resolved: ResolvedFittingRoom
  availabilityByExternalId: Record<string, Availability>
  selectedCount: number
  onSelectItem: (externalId: string) => void
  onRemoveItem: (externalId: string) => void
  onTryItOn: () => void
}) {
  const railsAreaRef = useRef<HTMLDivElement>(null)
  // group name → its wrapper element in the rails scroll area, for the
  // section-nav scroll-spy and jump-to-section.
  const sectionRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const [activeSectionName, setActiveSectionName] = useState<string | null>(null)

  const sections = resolved.groups.map((g) => ({ name: g.group.name, label: g.group.label }))

  // The active section is the topmost one whose top edge is still at or below
  // the rails-area top — i.e. the section whose start (content-area top) is
  // still visible. Once a section's top scrolls above the fold it's no longer
  // current; the next section, whose top is now visible, takes over. When
  // every section's top has scrolled off (deep in the last section), the last
  // section stays current.
  const recomputeActiveSection = useCallback(() => {
    const container = railsAreaRef.current
    if (!container) {
      return
    }
    const containerTop = container.getBoundingClientRect().top
    let active: string | null = null
    for (const [name, el] of sectionRefs.current) {
      if (el.getBoundingClientRect().top >= containerTop - 1) {
        active = name
        break
      }
    }
    if (active == null) {
      const groups = resolved.groups
      active = groups.length > 0 ? groups[groups.length - 1].group.name : null
    }
    setActiveSectionName(active)
  }, [resolved.groups])

  useLayoutEffect(() => {
    recomputeActiveSection()
  }, [recomputeActiveSection, resolved.groups])

  const scrollToSection = useCallback((name: string) => {
    const container = railsAreaRef.current
    const el = sectionRefs.current.get(name)
    if (!container || !el) {
      return
    }
    const delta = el.getBoundingClientRect().top - container.getBoundingClientRect().top
    container.scrollBy({ top: delta - SECTION_SCROLL_TOP_GAP_PX, behavior: 'smooth' })
  }, [])

  const css = useCss((_theme) => ({
    container: {
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      width: '100%',
      // Positioning context for the floating SectionNav pill.
      position: 'relative',
    },
    railsArea: {
      flex: 1,
      overflowY: 'auto',
      padding: '16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '24px',
    },
    bottomBar: {
      flex: 'none',
      padding: '16px',
      borderTop: '1px solid rgba(0, 0, 0, 0.1)',
      backgroundColor: '#FFFFFF',
    },
  }))
  return (
    <div css={css.container}>
      {/* Hold the section-nav back until product data has finished loading —
          while groups are still resolving the active-section readout flickers
          as rails appear and shift. */}
      {!resolved.isLoading && resolved.groups.length > 0 ? (
        <SectionNav sections={sections} activeName={activeSectionName} onSelect={scrollToSection} />
      ) : null}
      <div ref={railsAreaRef} css={css.railsArea} onScroll={recomputeActiveSection}>
        {resolved.groups.map((group) => (
          <div
            key={group.group.name}
            ref={(el) => {
              if (el) {
                sectionRefs.current.set(group.group.name, el)
              } else {
                sectionRefs.current.delete(group.group.name)
              }
            }}
          >
            <CardRail
              group={group}
              availabilityByExternalId={availabilityByExternalId}
              onSelectItem={onSelectItem}
              onRemoveItem={onRemoveItem}
            />
          </div>
        ))}
      </div>
      {/* Hold the CTA back until the card rails have resolved — otherwise it
          briefly renders alone (with an empty rails area collapsed to zero
          height) and floats up to the top of the overlay. */}
      {resolved.groups.length > 0 ? (
        <div css={css.bottomBar}>
          <ButtonT variant="brand" t="fitting_room.try_it_on" onClick={onTryItOn} disabled={selectedCount === 0} />
        </div>
      ) : null}
    </div>
  )
}

function TryOnView({
  selectedItems,
  openAccordionItemId,
  detailMode,
  forceUntuck,
  canTuck,
  frameUrls,
  sheetSnap,
  sheetTouchStart,
  onBackToBrowse,
  onOpenAccordionItem,
  onChangeDetailMode,
  onChangeSize,
  onChangeColor,
  onAddToCart,
  onToggleUntuck,
}: {
  selectedItems: ResolvedFittingRoomItem[]
  openAccordionItemId: string | null
  detailMode: DetailMode
  forceUntuck: boolean
  canTuck: boolean
  frameUrls: string[] | null
  sheetSnap: SheetSnap
  sheetTouchStart: (e: React.TouchEvent<HTMLElement>) => void
  onBackToBrowse: () => void
  onOpenAccordionItem: (externalId: string | null) => void
  onChangeDetailMode: (mode: DetailMode) => void
  onChangeSize: (externalId: string, sizeLabel: string) => void
  onChangeColor: (externalId: string, colorLabel: string | null) => void
  onAddToCart: (externalId: string) => void
  onToggleUntuck: () => void
}) {
  const innerRef = useRef<HTMLDivElement>(null)
  const [sheetStyle, setSheetStyle] = useState<StyleProp>({})

  // Quick-row form when sheet is in expanded but no item is open;
  // promote to full-detail rendering when sheet is 'full' OR an item is open.
  const isMobileQuickRow = sheetSnap === 'expanded' && openAccordionItemId == null

  // Resize sheet container to its content height (capped by max-height).
  useEffect(() => {
    function refresh() {
      const el = innerRef.current
      if (!el) {
        return
      }
      const parentEl = el.parentElement
      if (!parentEl) {
        return
      }
      const maxHeightPx = Number(window.getComputedStyle(parentEl).getPropertyValue('max-height').replace('px', ''))
      const heightPx = Math.min(el.clientHeight, maxHeightPx || el.clientHeight)
      setSheetStyle({ height: `${heightPx}px` })
    }
    setSheetStyle({})
    const timeoutId = setTimeout(refresh, 50)
    return () => clearTimeout(timeoutId)
  }, [sheetSnap, openAccordionItemId, detailMode])

  const css = useCss((_theme) => ({
    container: {
      width: '100%',
      height: '100%',
      position: 'relative',
    },
    backButton: {
      position: 'absolute',
      top: '12px',
      left: '10px',
      width: '30px',
      height: '30px',
      border: 'none',
      borderRadius: '15px',
      backgroundColor: 'rgba(255, 255, 255, 0.85)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2,
    },
    backArrow: {
      width: '14px',
      height: '15px',
    },
    sheetOuter: {
      position: 'absolute',
      // 8px gap to either side, matching quick-view's mobile sheet.
      left: '8px',
      right: '8px',
      bottom: 0,
      maxHeight: '85vh',
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderTopLeftRadius: '28px',
      borderTopRightRadius: '28px',
      borderTop: '1px solid rgba(0, 0, 0, 0.1)',
      borderLeft: '1px solid rgba(0, 0, 0, 0.1)',
      borderRight: '1px solid rgba(0, 0, 0, 0.1)',
      transition: 'height 0.4s',
      overflow: 'hidden',
    },
    sheetInner: {
      width: '100%',
      // Narrow L/R padding so the accordion fills more of the sheet width.
      padding: '12px 8px 16px 8px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'stretch',
      gap: '8px',
    },
    sheetHandleRow: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      paddingBottom: '8px',
    },
    sheetTitle: {
      fontSize: '16px',
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
      marginTop: '8px',
    },
    sheetContent: {
      overflowY: 'auto',
    },
  }))

  return (
    <div css={css.container}>
      <AvatarPane
        hasSelection={selectedItems.length > 0}
        frameUrls={frameUrls}
        mobileFullscreen
        controls={<MobileTuckControl canTuck={canTuck} forceUntuck={forceUntuck} onToggleUntuck={onToggleUntuck} />}
      />
      <Button variant="base" css={css.backButton} onClick={onBackToBrowse} aria-label="Back to browse">
        <LeftArrowIcon css={css.backArrow} />
      </Button>
      <div css={css.sheetOuter} style={sheetStyle}>
        <div ref={innerRef} css={css.sheetInner} style={sheetStyle}>
          <div css={css.sheetHandleRow} onTouchStart={sheetTouchStart}>
            <DragHandleIcon />
            <Text variant="base" css={css.sheetTitle}>
              {/* "RECOMMENDED SIZES" header */}
              RECOMMENDED SIZES
            </Text>
          </div>
          {sheetSnap === 'collapsed' ? null : (
            <div css={css.sheetContent}>
              <DetailAccordion
                items={selectedItems}
                openItemExternalId={openAccordionItemId}
                platform="mobile"
                detailMode={detailMode}
                isMobileQuickRow={isMobileQuickRow}
                forceUntuck={forceUntuck}
                canTuck={canTuck}
                onOpenItem={onOpenAccordionItem}
                onChangeDetailMode={onChangeDetailMode}
                onChangeSize={onChangeSize}
                onChangeColor={onChangeColor}
                onAddToCart={onAddToCart}
                onToggleUntuck={onToggleUntuck}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
