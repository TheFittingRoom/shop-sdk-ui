import { Button } from '@/components/button'
import { ContentModal } from '@/components/modal'
import { Text, TextT } from '@/components/text'
import { useTranslation } from '@/lib/locale'
import { useMainStore } from '@/lib/store'
import { useCss } from '@/lib/theme'

export default function FittingRoomOverlay() {
  const { t } = useTranslation()
  const fittingRoom = useMainStore((state) => state.fittingRoom)
  const removeFromFittingRoom = useMainStore((state) => state.removeFromFittingRoom)
  const closeOverlay = useMainStore((state) => state.closeOverlay)

  const css = useCss((theme) => ({
    list: {
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      width: '100%',
      marginTop: '16px',
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
      marginTop: '24px',
      textAlign: 'center',
    },
  }))

  return (
    <ContentModal onRequestClose={closeOverlay} title={t('fitting_room.title')}>
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
    </ContentModal>
  )
}
