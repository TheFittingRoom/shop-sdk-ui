import { useEffect, useRef, useState } from 'react'
import { Button, ButtonT } from '@/components/button'
import { HelpTip } from '@/components/help-tooltip'
import { Text } from '@/components/text'
import type { VtoTuckLabel } from '@/api/gen/enums'
import type { ResolvedFittingRoom, ResolvedFittingRoomItem } from '@/lib/fitting-room-data'
import { DragHandleIcon, LeftArrowIcon, TfrIcon } from '@/lib/asset'
import { LinkT } from '@/components/link'
import type { SheetSnap } from '@/lib/use-mobile-sheet-snap'
import type { StyleProp } from '@/lib/theme'
import { useCss } from '@/lib/theme'
import type { Availability } from '@/lib/fitting-room-outfit'
import { AvatarPane } from './avatar-pane'
import { MobileTuckControl } from './avatar-controls'
import { CardRail } from './card-rail'
import { ClearAllPill } from './clear-all-pill'
import { DetailAccordion } from './detail-accordion'
import type { DetailMode } from './detail-accordion-item'
import { SectionNav, useSectionNav } from './section-nav'
import { TopRightPills } from './top-right-pills'
import { MiniMePill } from '@/components/mini-me-pill'

export type MobileMode = 'browse' | 'try-on'

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
  // Which wording the tuck control uses — from the VTO response.
  tuckLabel: VtoTuckLabel
  frameUrls: string[] | null
  autoRotateTrigger: number | undefined
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
  // Add every selected item to the cart. Disabled while it runs, and while
  // the selection holds an item with no fitting size.
  onAddAllToCart: () => void
  addAllToCartDisabled: boolean
  onToggleUntuck: () => void
  onSignOut: () => void
  onClearAll: () => void
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
  tuckLabel,
  frameUrls,
  autoRotateTrigger,
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
  onAddAllToCart,
  addAllToCartDisabled,
  onToggleUntuck,
  onSignOut,
  onClearAll,
}: MobileLayoutProps) {
  if (mode === 'browse') {
    return (
      <BrowseView
        resolved={resolved}
        availabilityByExternalId={availabilityByExternalId}
        selectedCount={selectedItems.length}
        onSelectItem={onSelectItem}
        onRemoveItem={onRemoveItem}
        onChangeColor={onChangeColor}
        onTryItOn={onTryItOn}
        onSignOut={onSignOut}
        onClearAll={onClearAll}
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
      tuckLabel={tuckLabel}
      frameUrls={frameUrls}
      autoRotateTrigger={autoRotateTrigger}
      sheetSnap={sheetSnap}
      sheetTouchStart={sheetTouchStart}
      onBackToBrowse={onBackToBrowse}
      onOpenAccordionItem={onOpenAccordionItem}
      onChangeDetailMode={onChangeDetailMode}
      onChangeSize={onChangeSize}
      onChangeColor={onChangeColor}
      onAddToCart={onAddToCart}
      onAddAllToCart={onAddAllToCart}
      addAllToCartDisabled={addAllToCartDisabled}
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
  onChangeColor,
  onTryItOn,
  onSignOut,
  onClearAll,
}: {
  resolved: ResolvedFittingRoom
  availabilityByExternalId: Record<string, Availability>
  selectedCount: number
  onSelectItem: (externalId: string) => void
  onRemoveItem: (externalId: string) => void
  onChangeColor: (externalId: string, colorLabel: string | null) => void
  onTryItOn: () => void
  onSignOut: () => void
  onClearAll: () => void
}) {
  const tryItOnRef = useRef<HTMLDivElement>(null)
  const sections = resolved.groups.map((g) => ({ name: g.group.name, label: g.group.label }))
  const sectionNav = useSectionNav(sections)

  const css = useCss((theme) => ({
    container: {
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      width: '100%',
      // Positioning context for the floating SectionNav + Clear All pills.
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
    // Sign Out lives at the very bottom of the scrollable card list — same
    // pattern as desktop. Centered icon+link in TFR teal. Scrolls into view
    // once the shopper reaches the end of their items.
    signOutWrapper: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8px',
      cursor: 'pointer',
      color: theme.color_tfr_800,
      marginTop: '8px',
    },
    signOutIcon: {
      width: '12px',
      height: '22px',
      fill: theme.color_tfr_800,
      flex: 'none',
    },
    signOutText: {
      color: theme.color_tfr_800,
      fontSize: '14px',
    },
    // Clear All floats bottom-right of the BrowseView container, offset to
    // clear the Try It On CTA bar below it.
    clearAllPosition: {
      position: 'absolute',
      bottom: '96px',
      right: '16px',
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
          as rails appear and shift. Also hide when there's only one section:
          the dropdown has nothing to navigate to. */}
      <TopRightPills>
        <MiniMePill />
        {!resolved.isLoading && resolved.groups.length > 1 ? (
          <SectionNav sections={sections} activeName={sectionNav.activeName} onSelect={sectionNav.scrollToSection} />
        ) : null}
      </TopRightPills>
      <div ref={sectionNav.scrollerRef} css={css.railsArea} onScroll={sectionNav.onScroll}>
        {resolved.groups.map((group, index) => (
          <div key={group.group.name} ref={sectionNav.sectionRef(group.group.name)}>
            <CardRail
              group={group}
              availabilityByExternalId={availabilityByExternalId}
              onSelectItem={onSelectItem}
              onRemoveItem={onRemoveItem}
              onChangeColor={onChangeColor}
              firstCardHelpTip={index === 0 && !resolved.isLoading}
            />
          </div>
        ))}
        {/* Bottom of the scrollable card list — same pattern as desktop. */}
        <span css={css.signOutWrapper} onClick={onSignOut}>
          <TfrIcon css={css.signOutIcon} />
          <LinkT variant="underline" css={css.signOutText} t="fitting_room.sign_out" />
        </span>
      </div>
      {/* Floating Clear All pill — bottom-right of the BrowseView container,
          mirrors the SectionNav pill at the top-right. */}
      <ClearAllPill onClick={onClearAll} position={css.clearAllPosition} />
      {/* Hold the CTA back until the card rails have resolved — otherwise it
          briefly renders alone (with an empty rails area collapsed to zero
          height) and floats up to the top of the overlay. */}
      {resolved.groups.length > 0 ? (
        <div ref={tryItOnRef} css={css.bottomBar}>
          <ButtonT variant="brand" t="fitting_room.try_it_on" onClick={onTryItOn} disabled={selectedCount === 0} />
          {/* Offered once something is selected — before that the button is
              disabled and there is no outfit to see. */}
          <HelpTip
            id="fitting_room_try_it_on"
            enabled={selectedCount > 0}
            anchorRef={tryItOnRef}
            t="help_tip.fitting_room_try_it_on"
            placement="above"
          />
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
  tuckLabel,
  frameUrls,
  autoRotateTrigger,
  sheetSnap,
  sheetTouchStart,
  onBackToBrowse,
  onOpenAccordionItem,
  onChangeDetailMode,
  onChangeSize,
  onChangeColor,
  onAddToCart,
  onAddAllToCart,
  addAllToCartDisabled,
  onToggleUntuck,
}: {
  selectedItems: ResolvedFittingRoomItem[]
  openAccordionItemId: string | null
  detailMode: DetailMode
  forceUntuck: boolean
  canTuck: boolean
  // Which wording the tuck control uses — from the VTO response.
  tuckLabel: VtoTuckLabel
  frameUrls: string[] | null
  autoRotateTrigger: number | undefined
  sheetSnap: SheetSnap
  sheetTouchStart: (e: React.TouchEvent<HTMLElement>) => void
  onBackToBrowse: () => void
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
}) {
  const innerRef = useRef<HTMLDivElement>(null)
  const sheetHandleRef = useRef<HTMLDivElement>(null)
  const backButtonRef = useRef<HTMLButtonElement>(null)
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

  const css = useCss((theme) => ({
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
    // Top-right, across from the back button.
    miniMePosition: {
      position: 'absolute',
      top: '12px',
      right: '10px',
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
    // TFR teal rather than the brand colour, as on desktop.
    addAllToCart: {
      backgroundColor: theme.color_tfr_800,
      color: '#FFFFFF',
      marginTop: '12px',
    },
  }))

  return (
    <div css={css.container}>
      <AvatarPane
        hasSelection={selectedItems.length > 0}
        frameUrls={frameUrls}
        autoRotateTrigger={autoRotateTrigger}
        mobileFullscreen
        controls={
          <MobileTuckControl
            canTuck={canTuck}
            tuckLabel={tuckLabel}
            forceUntuck={forceUntuck}
            onToggleUntuck={onToggleUntuck}
          />
        }
      />
      <Button
        ref={backButtonRef}
        variant="base"
        css={css.backButton}
        onClick={onBackToBrowse}
        aria-label="Back to browse"
      >
        <LeftArrowIcon css={css.backArrow} />
      </Button>
      <HelpTip id="try_on_back" enabled anchorRef={backButtonRef} t="help_tip.try_on_back" />
      <MiniMePill position={css.miniMePosition} />
      <div css={css.sheetOuter} style={sheetStyle}>
        <div ref={innerRef} css={css.sheetInner} style={sheetStyle}>
          <div ref={sheetHandleRef} css={css.sheetHandleRow} onTouchStart={sheetTouchStart}>
            <DragHandleIcon />
            <Text variant="base" css={css.sheetTitle}>
              {/* "RECOMMENDED SIZES" header */}
              RECOMMENDED SIZES
            </Text>
          </div>
          <HelpTip
            id="sheet_swipe_up"
            enabled={sheetSnap === 'collapsed' && selectedItems.length > 0}
            anchorRef={sheetHandleRef}
            t="help_tip.sheet_swipe_up"
            placement="above"
          />
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
                tuckLabel={tuckLabel}
                onOpenItem={onOpenAccordionItem}
                onChangeDetailMode={onChangeDetailMode}
                onChangeSize={onChangeSize}
                onChangeColor={onChangeColor}
                onAddToCart={onAddToCart}
                onToggleUntuck={onToggleUntuck}
              />
              {/* After the product rows, as on desktop, and likewise only with
                  two or more selected. */}
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
          )}
        </div>
      </div>
    </div>
  )
}
