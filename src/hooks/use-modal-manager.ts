import { computed, signal } from '@preact/signals'

const modalStack = signal<preact.JSX.Element[]>([])
const currentModalIndex = signal<number>(-1)

const isOpen = computed(() => currentModalIndex.value >= 0)
const currentModal = computed(() => {
  const index = currentModalIndex.value
  const stack = modalStack.value
  return index >= 0 && index < stack.length ? stack[index] : null
})

const visibleStack = computed(() => {
  const index = currentModalIndex.value
  const stack = modalStack.value
  return index >= 0 ? stack.slice(0, index) : []
})

const openModal = (modal: preact.JSX.Element) => {
  modalStack.value = [modal]
  currentModalIndex.value = 0
}

const closeModal = () => {
  const index = currentModalIndex.value
  if (index > 0) {
    currentModalIndex.value = index - 1
  } else {
    closeAll()
  }
}

const pushModal = (modal: preact.JSX.Element) => {
  modalStack.value = [...modalStack.value, modal]
  currentModalIndex.value = modalStack.value.length - 1
}

const popModal = () => {
  const index = currentModalIndex.value
  if (index > 0) {
    currentModalIndex.value = index - 1
    modalStack.value = modalStack.value.slice(0, -1)
  } else {
    closeAll()
  }
}

const closeAll = () => {
  modalStack.value = []
  currentModalIndex.value = -1
}

export const useModalManager = () => {
  return {
    isOpen,
    currentModal,
    stack: visibleStack,
    openModal,
    closeModal,
    pushModal,
    popModal,
    closeAll,
  }
}
