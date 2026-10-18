import { useCallback, useRef, useState } from 'react'
import { Button } from '@/components/button'
import { Text } from '@/components/text'
import { useScrollOverflow } from '@/components/use-scroll-overflow'
import type { ResolvedFittingRoomGroup } from '@/lib/fitting-room-data'
import { useCss } from '@/lib/theme'
import type { Availability } from '@/lib/fitting-room-outfit'
import { Chevron } from './chevron'
import { ProductCard } from './product-card'

interface CardRailProps {
  group: ResolvedFittingRoomGroup
  availabilityByExternalId: Record<string, Availability>
  onSelectItem: (externalId: string) => void
  onRemoveItem: (externalId: string) => void
  // Optional — both desktop and mobile-browse wire this through so the
  // per-card swatch row can re-fire the colour change. When absent,
  // ProductCard skips rendering the swatch row entirely.
  onChangeColor?: (externalId: string, colorLabel: string | null) => void
  // Desktop opts in to "selected garments float to the front of the rail",
  // making the shopper's current outfit picks visible without horizontal
  // scrolling. Mobile keeps the natural order so cards don't shuffle under
  // the shopper's finger.
  sortSelectedFirst?: boolean
  // The first card carries the "tap the cards" help popup. Set on the first
  // rail only, so there is one candidate card per screen.
  firstCardHelpTip?: boolean
}

// CardRail renders one style-category group as a collapsible section. The
// items always sit in a single horizontally-scrolling row (desktop and
// mobile alike). When the row overflows, a translucent chevron handle
// appears on whichever edge can still be scrolled.
export function CardRail({
  group,
  availabilityByExternalId,
  onSelectItem,
  onRemoveItem,
  onChangeColor,
  sortSelectedFirst,
  firstCardHelpTip = false,
}: CardRailProps) {
  const [collapsed, setCollapsed] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  // Re-measured when the item set or collapsed state changes, as well as on
  // resize (all of which can change scrollWidth).
  const overflow = useScrollOverflow(scrollRef, 'x', [collapsed, group.items])
  const canScrollLeft = overflow.start
  const canScrollRight = overflow.end

  const scrollByPage = useCallback((dir: 1 | -1) => {
    const el = scrollRef.current
    if (!el) {
      return
    }
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: 'smooth' })
  }, [])

  const css = useCss((theme) => ({
    container: {
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
    },
    header: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'flex-start',
      gap: '6px',
      padding: '8px 0',
      width: '100%',
    },
    headerLabel: {
      fontSize: '14px',
      fontWeight: '400',
      letterSpacing: '0.5px',
      textTransform: 'uppercase',
    },
    chevron: {
      display: 'inline-flex',
      alignItems: 'center',
      color: theme.color_fg_text,
      flex: 'none',
    },
    scrollWrapper: {
      position: 'relative',
    },
    horizontal: {
      display: 'flex',
      flexDirection: 'row',
      gap: '16px',
      overflowX: 'auto',
      padding: '4px 0',
      // Native scrollbar hidden — the chevron handles are the affordance.
      scrollbarWidth: 'none',
      '&::-webkit-scrollbar': {
        display: 'none',
      },
    },
    scrollHandle: {
      position: 'absolute',
      top: '4px',
      bottom: '4px',
      width: '32px',
      padding: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      // A grey tint (not pure white) so the handle stays visible even when
      // it overlaps a product image with a white background.
      backgroundColor: 'rgba(228, 228, 228, 0.62)',
      border: 'none',
      cursor: 'pointer',
      color: theme.color_fg_text,
      zIndex: 2,
    },
    scrollHandleLeft: {
      left: 0,
    },
    scrollHandleRight: {
      right: 0,
    },
  }))

  // Stable sort: selected items float to the front while non-selected items
  // keep their natural (backend-supplied) order. Array.prototype.sort is
  // stable in all modern engines, so a 0/1 key on selected-ness is enough.
  const orderedItems = sortSelectedFirst
    ? [...group.items].sort((a, b) => {
        const aSel = availabilityByExternalId[a.externalId] === 'selected' ? 0 : 1
        const bSel = availabilityByExternalId[b.externalId] === 'selected' ? 0 : 1
        return aSel - bSel
      })
    : group.items

  const cards = orderedItems.map((item, index) => (
    <ProductCard
      key={item.externalId}
      item={item}
      availability={availabilityByExternalId[item.externalId] ?? 'disabled'}
      onClick={() => onSelectItem(item.externalId)}
      onRemove={() => onRemoveItem(item.externalId)}
      onChangeColor={onChangeColor}
      helpTip={firstCardHelpTip && index === 0}
    />
  ))

  return (
    <div css={css.container}>
      <Button variant="base" css={css.header} onClick={() => setCollapsed((c) => !c)}>
        <Text variant="base" css={css.headerLabel}>
          {group.group.label}
        </Text>
        <span css={css.chevron}>
          <Chevron direction={collapsed ? 'down' : 'up'} />
        </span>
      </Button>
      {collapsed ? null : (
        <div css={css.scrollWrapper}>
          {canScrollLeft ? (
            <Button
              variant="base"
              css={{ ...css.scrollHandle, ...css.scrollHandleLeft }}
              onClick={() => scrollByPage(-1)}
            >
              <Chevron direction="left" size={20} />
            </Button>
          ) : null}
          <div ref={scrollRef} css={css.horizontal} onScroll={overflow.update}>
            {cards}
          </div>
          {canScrollRight ? (
            <Button
              variant="base"
              css={{ ...css.scrollHandle, ...css.scrollHandleRight }}
              onClick={() => scrollByPage(1)}
            >
              <Chevron direction="right" size={20} />
            </Button>
          ) : null}
        </div>
      )}
    </div>
  )
}
