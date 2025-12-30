import { useEffect } from 'react'
import { ContentModal } from '@/components/modal'
import { useMainStore } from '@/lib/store'
import { OverlayName } from '@/lib/view'

export default function VtoSingleOverlay() {
  const userIsLoggedIn = useMainStore((state) => state.userIsLoggedIn)
  const userHasAvatar = useMainStore((state) => state.userHasAvatar)
  const openOverlay = useMainStore((state) => state.openOverlay)
  const closeOverlay = useMainStore((state) => state.closeOverlay)
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
    <ContentModal onRequestClose={closeOverlay} title="Virtual Try-On">
      vto-single content
    </ContentModal>
  )
}
