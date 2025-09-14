import { useEffect, useState } from 'preact/hooks'

export type { GarmentLocation } from './use-garment-locations'
export type { Recommendation, Size, SizeLocation, SizeWithLocations } from './use-recommendation'

export interface SizeRecState {
  sku: string
  styleId: number | null
  isCollapsed: boolean
}

export interface SizeRecActions {
  setIsCollapsed: (isCollapsed: boolean) => void
  setSku: (sku: string) => void
  setStyleId: (styleId: number) => void
}

export const useSizeRec = (): SizeRecState & SizeRecActions => {
  const [sku, setSku] = useState('')
  const [styleId, setStyleId] = useState<number | null>(null)
  const [isCollapsed, setIsCollapsed] = useState(false)

  useEffect(() => {
    const handleSetSku = (event: CustomEvent) => {
      setSku(event.detail.sku)
    }

    const handleSetStyleId = (event: CustomEvent) => {
      console.log('handleSetStyleId', event.detail.styleId)
      setStyleId(event.detail.styleId)
    }

    window.addEventListener('fittingroom:setSku', handleSetSku as EventListener)
    window.addEventListener('fittingroom:setStyleId', handleSetStyleId as EventListener)

    // Signal that the hook is ready
    window.dispatchEvent(new CustomEvent('fittingroom:ready'))

    return () => {
      window.removeEventListener('fittingroom:setSku', handleSetSku as EventListener)
      window.removeEventListener('fittingroom:setStyleId', handleSetStyleId as EventListener)
    }
  }, [])

  return {
    sku,
    styleId,
    isCollapsed,
    setIsCollapsed,
    setSku,
    setStyleId,
  }
}
