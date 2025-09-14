import { useState } from 'preact/hooks'

import { usePreloadFrames, useTryOnMutation, useVtoFrameNavigation, type VtoFrame } from './data/use-vto-data'

export type { VtoFrame }

export interface VtoState {
  frames: VtoFrame[]
  currentFrameIndex: number
  isLoading: boolean
  isPreloading: boolean
  error: string | null
}

export interface VtoActions {
  tryOn: (styleId: number, sizeId: number) => Promise<void>
  setCurrentFrame: (index: number) => void
  nextFrame: () => void
  previousFrame: () => void
  clearFrames: () => void
}

export const useVto = (): VtoState & VtoActions => {
  const [frames, setFrames] = useState<VtoFrame[]>([])
  const tryOnMutation = useTryOnMutation()
  const { isPreloading } = usePreloadFrames(frames)
  const { currentFrameIndex, setCurrentFrame, nextFrame, previousFrame } = useVtoFrameNavigation(frames)

  const tryOn = async (styleId: number, sizeId: number) => {
    try {
      const result = await tryOnMutation.mutateAsync({ styleId, sizeId })
      setFrames(result.frames)
    } catch (err) {
      console.error('VTO generation failed:', err)
      setFrames([])
    }
  }

  const clearFrames = () => {
    setFrames([])
    tryOnMutation.reset()
  }

  return {
    frames,
    currentFrameIndex,
    isLoading: tryOnMutation.isPending,
    isPreloading,
    error: tryOnMutation.error?.message || null,
    tryOn,
    setCurrentFrame,
    nextFrame,
    previousFrame,
    clearFrames,
  }
}
