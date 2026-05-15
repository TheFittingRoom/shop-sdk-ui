import { useRef, useEffect, useState } from 'react'
import { Button, ButtonT } from '@/components/button'
import { Text } from '@/components/text'
import { ResolvedFittingRoom, ResolvedFittingRoomItem } from '@/lib/fitting-room-data'
import { DragHandleIcon } from '@/lib/asset'
import { SheetSnap } from '@/lib/use-mobile-sheet-snap'
import { useCss, StyleProp } from '@/lib/theme'
import { Availability } from './availability'
import { AvatarPane } from './avatar-pane'
import { CardRail } from './card-rail'
import { DetailAccordion } from './detail-accordion'
import { DetailMode } from './detail-accordion-item'

export type MobileMode = 'browse' | 'try-on'

interface MobileLayoutProps {
  mode: MobileMode
  resolved: ResolvedFittingRoom
  selectedItems: ResolvedFittingRoomItem[]
  availabilityByExternalId: Record<string, Availability>
  openAccordionItemId: string | null
  detailMode: DetailMode
  forceUntuck: boolean
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
      frameUrls={frameUrls}
      sheetSnap={sheetSnap}
      sheetTouchStart={sheetTouchStart}
      onBackToBrowse={onBackToBrowse}
      onOpenAccordionItem={onOpenAccordionItem}
      onChangeDetailMode={onChangeDetailMode}
      onChangeSize={onChangeSize}
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
  const css = useCss((_theme) => ({
    container: {
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      width: '100%',
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
      <div css={css.railsArea}>
        {resolved.groups.map((group) => (
          <CardRail
            key={group.group.name}
            group={group}
            availabilityByExternalId={availabilityByExternalId}
            onSelectItem={onSelectItem}
            onRemoveItem={onRemoveItem}
            layout="grid"
          />
        ))}
      </div>
      <div css={css.bottomBar}>
        <ButtonT variant="brand" t="fitting_room.try_it_on" onClick={onTryItOn} disabled={selectedCount === 0} />
      </div>
    </div>
  )
}

function TryOnView({
  selectedItems,
  openAccordionItemId,
  detailMode,
  forceUntuck,
  frameUrls,
  sheetSnap,
  sheetTouchStart,
  onBackToBrowse,
  onOpenAccordionItem,
  onChangeDetailMode,
  onChangeSize,
  onAddToCart,
  onToggleUntuck,
}: {
  selectedItems: ResolvedFittingRoomItem[]
  openAccordionItemId: string | null
  detailMode: DetailMode
  forceUntuck: boolean
  frameUrls: string[] | null
  sheetSnap: SheetSnap
  sheetTouchStart: (e: React.TouchEvent<HTMLElement>) => void
  onBackToBrowse: () => void
  onOpenAccordionItem: (externalId: string | null) => void
  onChangeDetailMode: (mode: DetailMode) => void
  onChangeSize: (externalId: string, sizeLabel: string) => void
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
      if (!el) return
      const maxHeightPx = Number(
        window.getComputedStyle(el.parentElement!).getPropertyValue('max-height').replace('px', ''),
      )
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
      fontSize: '18px',
      lineHeight: '1',
    },
    sheetOuter: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      maxHeight: '85vh',
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderTopLeftRadius: '28px',
      borderTopRightRadius: '28px',
      borderTop: '1px solid rgba(0, 0, 0, 0.1)',
      transition: 'height 0.4s',
      overflow: 'hidden',
    },
    sheetInner: {
      width: '100%',
      padding: '12px 16px 16px 16px',
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
      fontSize: '12px',
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
      <AvatarPane hasSelection={selectedItems.length > 0} frameUrls={frameUrls} />
      <Button variant="base" css={css.backButton} onClick={onBackToBrowse} aria-label="Back to browse">
        <span css={css.backArrow}>←</span>
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
                onOpenItem={onOpenAccordionItem}
                onChangeDetailMode={onChangeDetailMode}
                onChangeSize={onChangeSize}
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
