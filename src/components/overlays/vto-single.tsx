import { useEffect } from 'react'
import { ModalTitlebar, SidecarModalFrame } from '@/components/modal'
import { useTranslation } from '@/lib/locale'
import { useMainStore } from '@/lib/store'
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

  if (!userIsLoggedIn) {
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
