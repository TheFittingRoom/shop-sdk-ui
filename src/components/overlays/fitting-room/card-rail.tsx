import { useState } from 'react'
import { Button } from '@/components/button'
import { Text } from '@/components/text'
import { ResolvedFittingRoomGroup } from '@/lib/fitting-room-data'
import { useCss } from '@/lib/theme'
import { Availability } from './availability'
import { ProductCard } from './product-card'

interface CardRailProps {
  group: ResolvedFittingRoomGroup
  availabilityByExternalId: Record<string, Availability>
  onSelectItem: (externalId: string) => void
  onRemoveItem: (externalId: string) => void
  layout: 'horizontal' | 'grid'
}

// CardRail renders one style-category group as a collapsible section. The
// items inside scroll horizontally on desktop (`layout='horizontal'`) and wrap
// into a 2-column grid on mobile (`layout='grid'`).
export function CardRail({ group, availabilityByExternalId, onSelectItem, onRemoveItem, layout }: CardRailProps) {
  const [collapsed, setCollapsed] = useState(false)

  const css = useCss((theme) => ({
    container: {
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
    },
    header: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '8px 0',
      borderBottom: `1px solid ${theme.color_fg_text}`,
    },
    headerLabel: {
      fontSize: '12px',
      fontWeight: '600',
      letterSpacing: '0.5px',
      textTransform: 'uppercase',
    },
    chevron: {
      fontSize: '12px',
    },
    horizontal: {
      display: 'flex',
      flexDirection: 'row',
      gap: '8px',
      overflowX: 'auto',
      padding: '4px 0',
    },
    grid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(2, 1fr)',
      gap: '8px',
      padding: '4px 0',
    },
  }))

  return (
    <div css={css.container}>
      <Button variant="base" css={css.header} onClick={() => setCollapsed((c) => !c)}>
        <Text variant="base" css={css.headerLabel}>
          {group.group.label}
        </Text>
        <span css={css.chevron}>{collapsed ? '⌄' : '⌃'}</span>
      </Button>
      {collapsed ? null : (
        <div css={layout === 'horizontal' ? css.horizontal : css.grid}>
          {group.items.map((item) => (
            <ProductCard
              key={item.externalId}
              item={item}
              availability={availabilityByExternalId[item.externalId] ?? 'disabled'}
              onClick={() => onSelectItem(item.externalId)}
              onRemove={() => onRemoveItem(item.externalId)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
