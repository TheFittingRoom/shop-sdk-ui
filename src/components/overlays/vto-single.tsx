import { Modal } from '@/components/modal'
import { useMainStore } from '@/lib/store'

export default function VtoSingleOverlay() {
  const closeOverlay = useMainStore((state) => state.closeOverlay)
  return <Modal isOpen onRequestClose={closeOverlay}>This is the VTO single overlay.</Modal>
}
