import { useEffect, useState } from 'react'
import { Button } from '@/components/button'
import { ModalFrame } from '@/components/modal'
import { Text, TextT } from '@/components/text'
import { ResolvedFittingRoomItem, useResolvedFittingRoom } from '@/lib/fitting-room-data'
import { useTranslation } from '@/lib/locale'
import { getStaticData, useMainStore } from '@/lib/store'
import { useCss } from '@/lib/theme'

function measureTopOffset(): number {
  const { getOverlayTopOffset } = getStaticData()
  if (!getOverlayTopOffset) {
    return 0
  }
  try {
    const offset = getOverlayTopOffset()
    return Number.isFinite(offset) && offset > 0 ? offset : 0
  } catch {
    return 0
  }
}

export default function FittingRoomOverlay() {
  const { t } = useTranslation()
  const removeFromFittingRoom = useMainStore((state) => state.removeFromFittingRoom)
  const closeOverlay = useMainStore((state) => state.closeOverlay)
  const resolved = useResolvedFittingRoom()

  const [topOffset, setTopOffset] = useState<number>(() => 0)

  // Save scroll, scroll-to-top, measure offset; restore scroll on unmount.
  useEffect(() => {
    const savedScrollY = window.scrollY
    if (savedScrollY > 0) {
      window.scrollTo(0, 0)
    }
    setTopOffset(measureTopOffset())

    const onResize = () => setTopOffset(measureTopOffset())
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      if (savedScrollY > 0) {
        window.scrollTo(0, savedScrollY)
      }
    }
  }, [])

  const css = useCss((theme) => ({
    body: {
      width: '100%',
      height: '100%',
      overflowY: 'auto',
      padding: '24px',
      boxSizing: 'border-box',
    },
    section: {
      width: '100%',
      maxWidth: '760px',
      margin: '0 auto 24px auto',
    },
    sectionTitle: {
      fontWeight: 'bold',
      textTransform: 'uppercase',
      marginBottom: '12px',
      display: 'block',
    },
    list: {
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
    },
    item: {
      display: 'flex',
      flexDirection: 'column',
      gap: '4px',
      padding: '12px',
      borderColor: theme.color_fg_text,
      borderStyle: 'solid',
      borderWidth: '1px',
      borderRadius: '8px',
    },
    itemHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: '8px',
    },
    itemName: {
      fontWeight: 'bold',
    },
    itemMeta: {
      fontSize: '13px',
      color: theme.color_fg_text,
    },
    itemMissing: {
      fontSize: '13px',
      color: theme.color_danger,
    },
    removeButton: {
      fontSize: '13px',
      textDecoration: 'underline',
    },
    empty: {
      marginTop: '48px',
      textAlign: 'center',
    },
    loading: {
      marginTop: '12px',
      fontSize: '13px',
      color: theme.color_fg_text,
      opacity: 0.6,
    },
  }))

  const overlayStyle = {
    top: `${topOffset}px`,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
  }
  const contentStyle = {
    position: 'absolute' as const,
    inset: 0,
    margin: 0,
    padding: 0,
    border: 'none',
    borderRadius: 0,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden' as const,
  }

  function renderItem(item: ResolvedFittingRoomItem) {
    const displayName = item.merchantProduct?.productName ?? item.externalId
    const sizeColor = [item.storage.size, item.storage.color].filter(Boolean).join(' / ')
    const error = item.merchantError ?? item.loadedError
    return (
      <div key={item.externalId} css={css.item}>
        <div css={css.itemHeader}>
          <Text variant="base" css={css.itemName}>
            {displayName}
          </Text>
          <Button
            variant="base"
            css={css.removeButton}
            onClick={() => removeFromFittingRoom(item.externalId)}
          >
            {t('fitting_room.remove')}
          </Button>
        </div>
        {sizeColor ? (
          <Text variant="base" css={css.itemMeta}>
            {sizeColor}
          </Text>
        ) : null}
        {item.needsResize ? (
          <TextT variant="base" css={css.itemMissing} t="fitting_room.size_not_chosen" />
        ) : null}
        {error ? (
          <Text variant="base" css={css.itemMissing}>
            {error.message}
          </Text>
        ) : null}
      </div>
    )
  }

  return (
    <ModalFrame
      isOpen
      onRequestClose={closeOverlay}
      overlayStyle={overlayStyle}
      contentStyle={contentStyle}
    >
      <div css={css.body}>
        {resolved.items.length === 0 ? (
          <TextT variant="base" css={css.empty} t="fitting_room.empty" />
        ) : (
          <>
            {resolved.groups.map(({ group, items }) => (
              <div key={group.name} css={css.section}>
                <Text variant="base" css={css.sectionTitle}>
                  {group.label}
                </Text>
                <div css={css.list}>{items.map(renderItem)}</div>
              </div>
            ))}
            {resolved.ungrouped.length > 0 ? (
              <div css={css.section}>
                <Text variant="base" css={css.sectionTitle}>
                  {t('fitting_room.ungrouped')}
                </Text>
                <div css={css.list}>{resolved.ungrouped.map(renderItem)}</div>
              </div>
            ) : null}
            {resolved.isLoading ? (
              <div css={css.section}>
                <TextT variant="base" css={css.loading} t="loading" />
              </div>
            ) : null}
          </>
        )}
      </div>
    </ModalFrame>
  )
}
