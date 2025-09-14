import { useTfrShopContext } from '@contexts/tfr-shop-context'
import { type UseMutationResult, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'preact/hooks'
import { queryKeys } from './query-keys'

export interface VtoFrame {
  url: string
  angle: number
}

export interface TryOnVariables {
  styleId: number
  sizeId: number
}

export interface TryOnResult {
  frames: VtoFrame[]
  styleId: number
  sizeId: number
}

export const useTryOnMutation = (): UseMutationResult<TryOnResult, Error, TryOnVariables> => {
  const tfrShop = useTfrShopContext()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ styleId, sizeId }) => {
      const result = await tfrShop.tryOn(styleId, sizeId)

      if (!result || !Array.isArray(result)) {
        throw new Error('Invalid frames format received')
      }

      const frames: VtoFrame[] = result.map((url: string, index: number) => ({
        url,
        angle: index * (360 / result.length),
      }))

      const tryOnResult: TryOnResult = {
        frames,
        styleId,
        sizeId,
      }

      queryClient.setQueryData(queryKeys.vto.frames(styleId, sizeId), tryOnResult)

      return tryOnResult
    },
    onError: (error) => {
      console.error('VTO generation failed:', error)
    },
  })
}

export interface UsePreloadFramesResult {
  preloadedImages: HTMLImageElement[]
  isPreloading: boolean
  preloadProgress: number
}

export const usePreloadFrames = (frames: VtoFrame[]): UsePreloadFramesResult => {
  const [isPreloading, setIsPreloading] = useState(false)
  const [preloadProgress, setPreloadProgress] = useState(0)
  const preloadedImages = useRef<HTMLImageElement[]>([])

  useEffect(() => {
    if (frames.length === 0) {
      preloadedImages.current = []
      setPreloadProgress(0)
      return undefined
    }

    setIsPreloading(true)
    setPreloadProgress(0)
    const images: HTMLImageElement[] = []
    let loadedCount = 0

    const updateProgress = () => {
      loadedCount++
      setPreloadProgress((loadedCount / frames.length) * 100)
      if (loadedCount === frames.length) {
        setIsPreloading(false)
        preloadedImages.current = images
      }
    }

    frames.forEach((frame) => {
      const img = new Image()
      img.onload = updateProgress
      img.onerror = () => {
        console.error(`Failed to preload frame: ${frame.url}`)
        updateProgress()
      }
      img.src = frame.url
      images.push(img)
    })

    return () => {
      images.forEach((img) => {
        img.onload = null
        img.onerror = null
      })
    }
  }, [frames])

  return {
    preloadedImages: preloadedImages.current,
    isPreloading,
    preloadProgress,
  }
}

export interface VtoFrameNavigationResult {
  currentFrameIndex: number
  currentFrame: VtoFrame | null
  setCurrentFrame: (index: number) => void
  nextFrame: () => void
  previousFrame: () => void
}

export const useVtoFrameNavigation = (frames: VtoFrame[]): VtoFrameNavigationResult => {
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0)

  useEffect(() => {
    setCurrentFrameIndex(0)
  }, [frames])

  const setCurrentFrame = (index: number) => {
    if (index >= 0 && index < frames.length) {
      setCurrentFrameIndex(index)
    }
  }

  const nextFrame = () => {
    if (frames.length > 0) {
      setCurrentFrameIndex((prev) => (prev + 1) % frames.length)
    }
  }

  const previousFrame = () => {
    if (frames.length > 0) {
      setCurrentFrameIndex((prev) => (prev - 1 + frames.length) % frames.length)
    }
  }

  return {
    currentFrameIndex,
    currentFrame: frames[currentFrameIndex] || null,
    setCurrentFrame,
    nextFrame,
    previousFrame,
  }
}
