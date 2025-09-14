import { useSizeRecContext } from '@contexts/size-rec-context'
import { useEffect, useState } from 'preact/hooks'
import { useRecommendedSizes } from './data/use-recommendation-data'

export type SizeLocation = {
  fit: string
  isPerfect: boolean
  location: string
}

export interface Size {
  size: string
  size_id: number
}

export interface SizeWithIndex extends Size {
  index: number
}

export interface SizeWithLocations extends Size {
  locations: SizeLocation[]
}

export type Recommendation = {
  recommended: string
  sizes: SizeWithLocations[]
}

export const useRecommendation = () => {
  const { styleId } = useSizeRecContext()
  const { data: sizeRec, isPending, error, refetch } = useRecommendedSizes(styleId || 0)
  const [selectedSize, setSelectedSize] = useState<SizeWithIndex | null>(null)

  useEffect(() => {
    if (!sizeRec) return

    if (sizeRec.recommended) {
      const size = sizeRec.recommended
      const size_id = sizeRec.recommended_size_id
      const index = sizeRec.available_sizes?.findIndex((s: any) => s.id === size_id) || 0

      setSelectedSize({ size, size_id, index })
    } else if (sizeRec.sizes.length > 0) {
      const perfectFitSize = sizeRec.sizes.find((s) => s.locations.some((l) => l.isPerfect))

      if (perfectFitSize) {
        const size = perfectFitSize.size
        const size_id = perfectFitSize.size_id
        const index = sizeRec.sizes.findIndex((s) => s.size_id === perfectFitSize?.size_id)

        setSelectedSize({ size, size_id, index })
      } else {
        setSelectedSize({ ...sizeRec.sizes[0], index: 0 })
      }
    }
  }, [sizeRec])

  const recommendSize = async () => {
    if (!styleId) {
      console.error('No style ID set')
      return
    }
    await refetch()
  }

  const selectSize = (size: SizeWithIndex) => {
    setSelectedSize(size)
  }

  const recommendation: Recommendation | null = sizeRec
    ? {
        recommended: sizeRec.recommended,
        sizes: sizeRec.sizes,
      }
    : null

  return {
    recommendation,
    selectedSize,
    isLoading: isPending,
    error: error?.message || null,
    recommendSize,
    selectSize,
  }
}
