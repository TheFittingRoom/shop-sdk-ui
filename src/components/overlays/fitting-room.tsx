import { useEffect, useState } from 'react'
import { Button } from '@/components/button'
import { ModalFrame } from '@/components/modal'
import { Text, TextT } from '@/components/text'
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
  const fittingRoom = useMainStore((state) => state.fittingRoom)
  const removeFromFittingRoom = useMainStore((state) => state.removeFromFittingRoom)
  const closeOverlay = useMainStore((state) => state.closeOverlay)

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
    list: {
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      width: '100%',
      maxWidth: '760px',
      margin: '0 auto',
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
    itemId: {
      fontWeight: 'bold',
      wordBreak: 'break-all',
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

  return (
    <ModalFrame
      isOpen
      onRequestClose={closeOverlay}
      overlayStyle={overlayStyle}
      contentStyle={contentStyle}
    >
      <div css={css.body}>
        {fittingRoom.length === 0 ? (
          <TextT variant="base" css={css.empty} t="fitting_room.empty" />
        ) : (
          <div css={css.list}>
            {fittingRoom.map((item) => {
              const hasVariant = item.size != null
              return (
                <div key={item.externalId} css={css.item}>
                  <div css={css.itemHeader}>
                    <Text variant="base" css={css.itemId}>
                      {item.externalId}
                    </Text>
                    <Button
                      variant="base"
                      css={css.removeButton}
                      onClick={() => removeFromFittingRoom(item.externalId)}
                    >
                      {t('fitting_room.remove')}
                    </Button>
                  </div>
                  {hasVariant ? (
                    <Text variant="base" css={css.itemMeta}>
                      {[item.size, item.color].filter(Boolean).join(' / ')}
                    </Text>
                  ) : (
                    <TextT variant="base" css={css.itemMissing} t="fitting_room.size_not_chosen" />
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </ModalFrame>
  )
}
