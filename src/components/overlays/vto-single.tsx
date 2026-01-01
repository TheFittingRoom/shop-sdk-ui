import { useEffect } from 'react'
import { ModalTitlebar, SidecarModalFrame } from '@/components/modal'
import { getStyleByExternalId, getColorwaySizeAssetsByStyleId } from '@/lib/database'
import { useTranslation } from '@/lib/locale'
import { getStaticData, useMainStore } from '@/lib/store'
import { useCss } from '@/lib/theme'
import { OverlayName } from '@/lib/view'

export default function VtoSingleOverlay() {
  const { t } = useTranslation()
  const userIsLoggedIn = useMainStore((state) => state.userIsLoggedIn)
  const userHasAvatar = useMainStore((state) => state.userHasAvatar)
  const openOverlay = useMainStore((state) => state.openOverlay)
  const closeOverlay = useMainStore((state) => state.closeOverlay)
  const css = useCss((_theme) => ({
    mainContainer: {
      display: 'flex',
      height: '100%',
    },
    leftContainer: {
      width: '50%',
    },
    rightContainer: {
      width: '50%',
      padding: '16px',
    },
    contentContainer: {
      display: 'flex',
      flexDirection: 'column',
    },
  }))

  // Redirect if not logged in or no avatar
  useEffect(() => {
    if (!userIsLoggedIn) {
      openOverlay(OverlayName.LANDING, { returnToOverlay: OverlayName.VTO_SINGLE })
      return
    }
    if (userIsLoggedIn && userHasAvatar === false) {
      openOverlay(OverlayName.GET_APP, { returnToOverlay: OverlayName.VTO_SINGLE, noAvatar: true })
      return
    }
  }, [userIsLoggedIn, userHasAvatar, openOverlay])

  // api testing
  useEffect(() => {
    async function fetchData() {
      try {
        const { brandId, productExternalId } = getStaticData()
        const style = await getStyleByExternalId(brandId, productExternalId)
        if (!style) {
          console.log('No style found for', productExternalId)
          return
        }
        const colorwaySizeAssets = await getColorwaySizeAssetsByStyleId(brandId, style.id)
        console.log('Fetched style and colorway size assets:', style, colorwaySizeAssets)
      } catch (error) {
        console.error('Error fetching VTO data:', error)
      }
    }
    fetchData()
  }, [userIsLoggedIn, userHasAvatar])

  if (!userIsLoggedIn || !userHasAvatar) {
    return null
  }

  return (
    <SidecarModalFrame onRequestClose={closeOverlay}>
      <div css={css.mainContainer}>
        <div css={css.leftContainer}>left</div>
        <div css={css.rightContainer}>
          <ModalTitlebar title={t('try_it_on')} onCloseClick={closeOverlay} />
          <div css={css.contentContainer}>content</div>
        </div>
      </div>
    </SidecarModalFrame>
  )
}
