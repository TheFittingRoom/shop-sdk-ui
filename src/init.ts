import { FittingRoom, TFRHooks } from './tfr'
import { TFRCssVariables } from './components/SizeRecommendationController'

export type TrfConfig = {
  shopId: string | number
  modalDivId: string
  sizeRecMainDivId: string
  vtoMainDivId: string
  hooks?: TFRHooks
  cssVariables?: TFRCssVariables
  env?: string
}

export const initFittingRoom = async ({
  shopId,
  modalDivId,
  sizeRecMainDivId,
  vtoMainDivId,
  hooks = {},
  cssVariables = {},
  env = 'dev',
}: TrfConfig) => {
  const tfr = new FittingRoom(shopId, modalDivId, sizeRecMainDivId, vtoMainDivId, hooks, cssVariables, env)
  await tfr.onInit()

  return tfr
}
