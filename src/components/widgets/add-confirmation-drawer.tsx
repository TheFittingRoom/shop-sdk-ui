import { Button } from '@/components/button'
import { Text } from '@/components/text'
import { CloseIcon, TrashIcon } from '@/lib/asset'
import { useTranslation } from '@/lib/locale'
import { useMainStore } from '@/lib/store'
import { useCss } from '@/lib/theme'

interface AddConfirmationDrawerProps {
  onDismiss: () => void
  onOpenOverlay: () => void
}

// Mini-drawer anchored beneath the fitting-room icon. Fires when an item is
// added (via the lastAddEvent store signal — see fitting-room-icon.tsx).
// Flat structure: title row, subheader, item list, CTA. No collapsibles.
// Auto-dismiss and click-outside are handled by the parent.
export function AddConfirmationDrawer({ onDismiss, onOpenOverlay }: AddConfirmationDrawerProps) {
  const { t } = useTranslation()
  const fittingRoom = useMainStore((state) => state.fittingRoom)
  const merchantProductData = useMainStore((state) => state.merchantProductData)
  const removeFromFittingRoom = useMainStore((state) => state.removeFromFittingRoom)

  const css = useCss((theme) => ({
    drawer: {
      position: 'absolute',
      top: '100%',
      right: 0,
      marginTop: '12px',
      width: '320px',
      maxHeight: '480px',
      backgroundColor: '#FFFFFF',
      border: `1px solid ${theme.color_fg_text}`,
      borderRadius: '8px',
      boxShadow: '0 6px 20px rgba(0, 0, 0, 0.18)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      zIndex: 2147483646,
      fontFamily: theme.font_family,
    },
    arrow: {
      position: 'absolute',
      top: '-7px',
      right: '14px',
      width: 0,
      height: 0,
      borderLeft: '8px solid transparent',
      borderRight: '8px solid transparent',
      borderBottom: `8px solid ${theme.color_fg_text}`,
    },
    headerRow: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '12px 14px',
      borderBottom: `1px solid ${theme.color_fg_text}`,
    },
    title: {
      fontSize: '14px',
      fontWeight: 'bold',
    },
    closeBtn: {
      width: '24px',
      height: '24px',
      borderRadius: '12px',
      border: 'none',
      backgroundColor: 'transparent',
      cursor: 'pointer',
      padding: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
    closeIcon: {
      width: '12px',
      height: '12px',
    },
    subheader: {
      padding: '10px 14px',
      fontSize: '12px',
      color: theme.color_fg_text,
      backgroundColor: '#F4F4F4',
    },
    list: {
      overflowY: 'auto',
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
    },
    item: {
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      padding: '10px 14px',
      borderBottom: '1px solid rgba(0, 0, 0, 0.06)',
    },
    thumb: {
      width: '48px',
      height: '60px',
      backgroundColor: '#F4F4F4',
      flex: 'none',
      objectFit: 'cover',
    },
    itemBody: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      gap: '2px',
      minWidth: 0,
    },
    itemName: {
      fontSize: '13px',
      lineHeight: '1.3',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    },
    itemMeta: {
      fontSize: '12px',
      color: theme.color_fg_text,
      opacity: 0.7,
    },
    removeBtn: {
      width: '32px',
      height: '32px',
      borderRadius: '16px',
      border: 'none',
      backgroundColor: 'transparent',
      cursor: 'pointer',
      padding: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flex: 'none',
    },
    removeIcon: {
      width: '16px',
      height: '16px',
    },
    ctaWrapper: {
      padding: '12px 14px',
      borderTop: `1px solid ${theme.color_fg_text}`,
    },
  }))

  return (
    <div css={css.drawer} role="dialog" aria-label={t('add_confirmation.title')}>
      <div css={css.arrow} />
      <div css={css.headerRow}>
        <Text variant="base" css={css.title}>
          {t('add_confirmation.title')}
        </Text>
        <button css={css.closeBtn} onClick={onDismiss} aria-label={t('add_confirmation.dismiss')}>
          <CloseIcon css={css.closeIcon} />
        </button>
      </div>
      <Text variant="base" css={css.subheader}>
        {t('add_confirmation.added_header')}
      </Text>
      <div css={css.list}>
        {fittingRoom.map((item) => {
          const merchant = merchantProductData[item.externalId]
          const product = merchant && !('error' in merchant) ? merchant : null
          // Best-effort variant match: prefer (color, size); fall back to
          // (color, any size); fall back to the product's featured image.
          // The drawer renders before the overlay has populated size/color
          // for fresh-from-catalog adds, so the fallbacks must work.
          const variant =
            product?.variants.find((v) => v.color === item.color && (!item.size || v.size === item.size)) ??
            product?.variants.find((v) => v.color === item.color) ??
            null
          const imageUrl = variant?.imageUrl ?? product?.imageUrl ?? null
          const name = product?.productName ?? item.externalId
          const price = variant?.priceFormatted ?? product?.variants[0]?.priceFormatted ?? null
          const metaParts = [item.color, price].filter(Boolean)
          return (
            <div css={css.item} key={item.externalId}>
              {imageUrl ? <img src={imageUrl} css={css.thumb} alt="" /> : <div css={css.thumb} />}
              <div css={css.itemBody}>
                <Text variant="base" css={css.itemName}>
                  {name}
                </Text>
                {metaParts.length > 0 ? (
                  <Text variant="base" css={css.itemMeta}>
                    {metaParts.join(' · ')}
                  </Text>
                ) : null}
              </div>
              <button
                css={css.removeBtn}
                onClick={() => removeFromFittingRoom(item.externalId)}
                aria-label={t('add_confirmation.remove')}
              >
                <TrashIcon css={css.removeIcon} />
              </button>
            </div>
          )
        })}
      </div>
      <div css={css.ctaWrapper}>
        <Button variant="primary" onClick={onOpenOverlay}>
          {t('add_confirmation.cta')}
        </Button>
      </div>
    </div>
  )
}
