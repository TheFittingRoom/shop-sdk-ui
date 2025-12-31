import ArrowBackIcon from '@/assets/arrow-back.svg?react'
import CloseIcon from '@/assets/close-icon.svg?react'
import TfrIcon from '@/assets/tfr-icon.svg?react'
import TfrNameSvg from '@/assets/tfr-name.svg?react'
import { getStaticData } from '@/lib/store'

export { ArrowBackIcon, CloseIcon, TfrIcon, TfrNameSvg }

let baseUrl: string

export function _init() {
  const { config } = getStaticData()
  baseUrl = config.asset.baseUrl
}

export function getExternalAssetUrl(fileName: string): string {
  return `${baseUrl}/${fileName}`
}
