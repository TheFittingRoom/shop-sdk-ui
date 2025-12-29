import CloseIcon from '@/assets/close-icon.svg?react'
import TfrIcon from '@/assets/tfr-icon.svg?react'
import { getStaticData } from '@/lib/store'

export { CloseIcon, TfrIcon }

let baseUrl: string

export function _init() {
  const { config } = getStaticData()
  baseUrl = config.asset.baseUrl
}

export function getExternalAssetUrl(fileName: string): string {
  return `${baseUrl}/${fileName}`
}
