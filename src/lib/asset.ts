import ArrowBackIcon from '@/assets/arrow-back.svg?react'
import AVATAR_BOTTOM_BACKGROUND_URL from '@/assets/avatar-bottom-background.png'
import CheckCircleIcon from '@/assets/check-circle.svg?react'
import ChevronLeftIcon from '@/assets/chevron-left.svg?react'
import ChevronRightIcon from '@/assets/chevron-right.svg?react'
import CloseIcon from '@/assets/close-icon.svg?react'
import DragHandleIcon from '@/assets/drag-handle.svg?react'
import InfoIcon from '@/assets/info-icon.svg?react'
import LoadingCircleIcon from '@/assets/loading-circle.svg?react'
import TfrIcon from '@/assets/tfr-icon.svg?react'
import TfrNameSvg from '@/assets/tfr-name.svg?react'
import { getStaticData } from '@/lib/store'

export {
  ArrowBackIcon,
  AVATAR_BOTTOM_BACKGROUND_URL,
  CheckCircleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CloseIcon,
  DragHandleIcon,
  InfoIcon,
  LoadingCircleIcon,
  TfrIcon,
  TfrNameSvg,
}

let baseUrl: string

export function _init() {
  const { config } = getStaticData()
  baseUrl = config.asset.baseUrl
}

export function getExternalAssetUrl(fileName: string): string {
  return `${baseUrl}/${fileName}`
}
