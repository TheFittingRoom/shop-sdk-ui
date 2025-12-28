import CloseIcon from '@/assets/close-icon.svg?react'
import TfrIcon from '@/assets/tfr-icon.svg?react'
import { EnvName, getConfig } from '@/lib/config'

export { CloseIcon, TfrIcon }

let baseUrl: string

export function _init(environment: EnvName) {
  const config = getConfig(environment)
  baseUrl = config.asset.baseUrl
}

export function getExternalAssetUrl(fileName: string): string {
  return `${baseUrl}/${fileName}`
}
