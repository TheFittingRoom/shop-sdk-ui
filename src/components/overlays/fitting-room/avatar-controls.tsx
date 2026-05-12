import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/button'
import { Text } from '@/components/text'
import { ResolvedFittingRoomItem } from '@/lib/fitting-room-data'
import { useTranslation } from '@/lib/locale'
import { useCss } from '@/lib/theme'

interface AvatarControlsProps {
  selectedItems: ResolvedFittingRoomItem[]
  hasTuckable: boolean
  forceUntuck: boolean
  zoomed: boolean
  onToggleUntuck: () => void
  onToggleZoom: () => void
  onRemoveItem: (externalId: string) => void
}

// Desktop-only control cluster anchored at the bottom-right of the avatar
// pane. Three state-labeled pill buttons: See Selected Items (popover with
// thumbnails + remove X), Tuck/Untuck (only when at least one selection is
// tuckable), and Zoom In/Out.
export function AvatarControls({
  selectedItems,
  hasTuckable,
  forceUntuck,
  zoomed,
  onToggleUntuck,
  onToggleZoom,
  onRemoveItem,
}: AvatarControlsProps) {
  const { t } = useTranslation()
  const [popoverOpen, setPopoverOpen] = useState(false)
  const popoverWrapperRef = useRef<HTMLDivElement>(null)

  // Click-outside dismisses the popover.
  useEffect(() => {
    if (!popoverOpen) return
    const onDocClick = (e: MouseEvent) => {
      if (popoverWrapperRef.current && !popoverWrapperRef.current.contains(e.target as Node)) {
        setPopoverOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [popoverOpen])

  const handleTogglePopover = useCallback(() => {
    setPopoverOpen((open) => !open)
  }, [])

  const css = useCss((theme) => ({
    wrapper: {
      position: 'absolute',
      right: '16px',
      bottom: '16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      alignItems: 'flex-end',
    },
    pill: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '8px',
      padding: '8px 16px',
      borderRadius: '24px',
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      border: `1px solid ${theme.color_fg_text}`,
      fontSize: '12px',
      fontWeight: '500',
      letterSpacing: '0.5px',
      textTransform: 'uppercase',
      cursor: 'pointer',
    },
    popover: {
      position: 'absolute',
      bottom: 'calc(100% + 8px)',
      right: 0,
      width: '280px',
      maxHeight: '320px',
      overflowY: 'auto',
      backgroundColor: '#FFFFFF',
      border: `1px solid ${theme.color_fg_text}`,
      borderRadius: '8px',
      padding: '8px',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
      display: 'flex',
      flexDirection: 'column',
      gap: '4px',
    },
    popoverRow: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '6px',
    },
    popoverThumb: {
      width: '40px',
      height: '52px',
      backgroundColor: '#F4F4F4',
      flex: 'none',
      objectFit: 'cover',
    },
    popoverLabel: {
      flex: 1,
      fontSize: '12px',
    },
    popoverRemove: {
      width: '24px',
      height: '24px',
      borderRadius: '12px',
      border: 'none',
      backgroundColor: 'transparent',
      cursor: 'pointer',
      fontSize: '14px',
    },
  }))

  const seePill = (
    <div ref={popoverWrapperRef} style={{ position: 'relative' }}>
      <Button variant="base" css={css.pill} onClick={handleTogglePopover}>
        <Text variant="base">{t('fitting_room.see_selected_items')}</Text>
      </Button>
      {popoverOpen ? (
        <div css={css.popover}>
          {selectedItems.length === 0 ? (
            <Text variant="base" css={css.popoverLabel}>
              {t('fitting_room.no_selection')}
            </Text>
          ) : (
            selectedItems.map((item) => (
              <div key={item.externalId} css={css.popoverRow}>
                {item.merchantProduct?.imageUrl ? (
                  <img src={item.merchantProduct.imageUrl} css={css.popoverThumb} alt="" />
                ) : (
                  <div css={css.popoverThumb} />
                )}
                <Text variant="base" css={css.popoverLabel}>
                  {item.merchantProduct?.productName ?? item.externalId}
                </Text>
                <button css={css.popoverRemove} onClick={() => onRemoveItem(item.externalId)} aria-label="Remove">
                  ×
                </button>
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  )

  return (
    <div css={css.wrapper}>
      {seePill}
      {hasTuckable ? (
        <Button variant="base" css={css.pill} onClick={onToggleUntuck}>
          <Text variant="base">
            {t(forceUntuck ? 'fitting_room.tuck_in' : 'fitting_room.untuck')}
          </Text>
        </Button>
      ) : null}
      <Button variant="base" css={css.pill} onClick={onToggleZoom}>
        <Text variant="base">
          {t(zoomed ? 'fitting_room.zoom_out' : 'fitting_room.zoom_in')}
        </Text>
      </Button>
    </div>
  )
}
