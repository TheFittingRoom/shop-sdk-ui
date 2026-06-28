import { useEffect } from 'react'
import { Button } from '@/components/button'
import { Text } from '@/components/text'
import { TrashIcon } from '@/lib/asset'
import { loadMerchantProductData } from '@/lib/fitting-room-data'
import { useTranslation } from '@/lib/locale'
import { useMainStore } from '@/lib/store'
import { useCss } from '@/lib/theme'

interface AddConfirmationDrawerProps {
  onDismiss: () => void
  onOpenOverlay: () => void
  // Called the first time the shopper interacts with the drawer (hover,
  // pointer, focus). The parent cancels its auto-dismiss timer so engaged
  // shoppers don't have it close out from under them.
  onInteract: () => void
}

// Arrow geometry mirrors the first-visit tooltip. Drawer is right-anchored
// to the icon, so the arrow's horizontal position is fixed relative to the
// drawer's right edge: icon centre is 22px from drawer right (icon is 44px
// wide, drawer aligns to icon's right edge); the 32px-wide arrow sits 6px
// from the drawer's right edge so its centre lines up with the icon.
const ARROW_WIDTH = 32
const ARROW_HEIGHT = 16
const ARROW_RIGHT = 6

// Mini-drawer anchored beneath the fitting-room icon. Fires when an item is
// added (via the lastAddEvent store signal — see fitting-room-icon.tsx).
// Flat structure: title row, subheader, item list, CTA. No collapsibles.
// Auto-dismiss and click-outside are handled by the parent.
export function AddConfirmationDrawer({ onDismiss, onOpenOverlay, onInteract }: AddConfirmationDrawerProps) {
  const { t } = useTranslation()
  const fittingRoom = useMainStore((state) => state.fittingRoom)
  const merchantProductData = useMainStore((state) => state.merchantProductData)
  const removeFromFittingRoom = useMainStore((state) => state.removeFromFittingRoom)

  // Trigger merchant productLookup on mount for any items not already in the
  // store cache. The drawer fires before the fitting-room overlay opens (the
  // overlay's loadFittingRoomData is normally what populates this), so for a
  // freshly-added item the drawer would otherwise show just the externalId.
  useEffect(() => {
    void loadMerchantProductData(fittingRoom)
    // Run once per fittingRoom identity change (each add gives a new array).
  }, [fittingRoom])

  const css = useCss((theme) => ({
    wrapper: {
      position: 'absolute',
      top: '100%',
      right: 0,
      marginTop: `${ARROW_HEIGHT}px`,
      width: '320px',
      zIndex: 2147483646,
      fontFamily: theme.font_family,
    },
    arrow: {
      position: 'absolute',
      top: `-${ARROW_HEIGHT - 1}px`,
      right: `${ARROW_RIGHT}px`,
      width: `${ARROW_WIDTH}px`,
      height: `${ARROW_HEIGHT}px`,
      color: theme.color_tfr_800,
      pointerEvents: 'none',
    },
    drawer: {
      width: '100%',
      maxHeight: '480px',
      backgroundColor: '#FFFFFF',
      border: `3px solid ${theme.color_tfr_800}`,
      borderRadius: '8px',
      boxShadow: '0 6px 20px rgba(0, 0, 0, 0.18)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    },
    header: {
      position: 'relative',
      padding: '12px 40px',
      borderBottom: `1px solid rgba(0, 0, 0, 0.1)`,
    },
    title: {
      fontSize: '14px',
      fontWeight: 'bold',
      textAlign: 'center',
    },
    closeBtn: {
      position: 'absolute',
      top: '8px',
      right: '8px',
      width: '24px',
      height: '24px',
      borderRadius: '12px',
      border: 'none',
      backgroundColor: 'transparent',
      color: theme.color_fg_text,
      cursor: 'pointer',
      padding: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
    subheader: {
      padding: '10px 14px',
      fontSize: '12px',
      color: theme.color_fg_text,
      backgroundColor: '#F4F4F4',
      textAlign: 'center',
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
      borderTop: `1px solid rgba(0, 0, 0, 0.1)`,
    },
  }))

  return (
    <div
      css={css.wrapper}
      role="dialog"
      aria-label={t('add_confirmation.title')}
      onMouseEnter={onInteract}
      onPointerDown={onInteract}
      onFocus={onInteract}
    >
      <svg
        css={css.arrow}
        viewBox={`0 0 ${ARROW_WIDTH} ${ARROW_HEIGHT}`}
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <polygon points={`0,${ARROW_HEIGHT} ${ARROW_WIDTH / 2},0 ${ARROW_WIDTH},${ARROW_HEIGHT}`} fill="currentColor" />
      </svg>
      <div css={css.drawer}>
        <div css={css.header}>
          <Text variant="base" css={css.title}>
            {t('add_confirmation.title')}
          </Text>
          <button css={css.closeBtn} onClick={onDismiss} aria-label={t('add_confirmation.dismiss')}>
            <svg width="12" height="12" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M1 1L9 9M9 1L1 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <Text variant="base" css={css.subheader}>
          {t('add_confirmation.added_header')}
        </Text>
        <div css={css.list}>
          {fittingRoom.map((item) => {
            const merchant = merchantProductData[item.externalId]
            const product = merchant && !('error' in merchant) ? merchant : null
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
    </div>
  )
}
