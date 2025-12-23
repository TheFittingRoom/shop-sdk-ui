import { useState } from 'react'
import Modal from 'react-modal'
import { WidgetProps } from '@/lib/widget-types'
import { useTfrStore } from '@/lib/store'

export default function VtoButton({}: WidgetProps) {
  const incrementCounter = useTfrStore((state) => state.incrementCounter)
  const [modalIsOpen, setModalIsOpen] = useState(false)

  const openModal = () => {
    setModalIsOpen(true)
  }

  const closeModal = () => {
    setModalIsOpen(false)
  }

  return (
    <>
      <button onClick={openModal}>Virtual Try-On</button>
      <button onClick={incrementCounter}>increment counter</button>
      <style>{`
        body.ReactModal__Body--open {
          overflow: hidden;
          position: fixed; 
          width: 100%;
        }
      `}</style>
      <Modal isOpen={modalIsOpen} onRequestClose={closeModal} style={{ overlay: { zIndex: 1000 } }}>
        <h2>Virtual Try-On</h2>
        <button onClick={closeModal}>Close</button>
      </Modal>
    </>
  )
}
