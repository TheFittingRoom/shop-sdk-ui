import { create } from 'zustand'

export interface TfrStoreState {
  counter: number
  incrementCounter: () => void
}

export const useTfrStore = create<TfrStoreState>((set) => ({
  counter: 0,
  incrementCounter: () =>
    set((state) => ({
      counter: state.counter + 1,
    })),
}))
