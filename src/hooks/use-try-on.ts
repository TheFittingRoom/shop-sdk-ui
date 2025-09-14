import { useState } from 'preact/hooks'
import type { Recommendation, Size } from './use-recommendation'

interface UseTryOnParams {
  styleId: number | null
  selectedSize: Size | null
  recommendation: Recommendation | null
}

export const useTryOn = ({ styleId, selectedSize, recommendation }: UseTryOnParams) => {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const tryOnCurrentSize = async () => {
    if (!styleId || !selectedSize) {
      setError('No style or size selected')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const selectedRec = recommendation?.sizes.find((r) => r.size_id === selectedSize.size_id)
      if (!selectedRec) throw new Error('Size not found in recommendations')

      // TODO: Implement actual try-on logic
      console.warn('tryOnCurrentSize needs size ID tracking implementation')
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start try-on'
      setError(errorMessage)
      console.error('Try-on failed:', err)
    } finally {
      setIsLoading(false)
    }
  }

  return {
    tryOnCurrentSize,
    isLoading,
    error,
  }
}
