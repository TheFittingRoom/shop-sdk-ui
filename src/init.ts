import { FittingRoom, TFRHooks } from './tfr'
import { TFRCssVariables } from './components/SizeRecommendationController'

export type TrfConfig = {
  shopId: string | number
  modalDivId: string
  sizeRecMainDivId: string
  vtoMainDivId: string
  noCacheOnRetry?: boolean // Enable VTO retry with cache bypass
  hooks?: TFRHooks
  cssVariables?: TFRCssVariables
  env?: string
}

export const initFittingRoom = async ({
  shopId,
  modalDivId,
  sizeRecMainDivId,
  vtoMainDivId,
  noCacheOnRetry = false,
  hooks = {},
  cssVariables = {},
  env = 'dev',
}: TrfConfig): Promise<FittingRoom> => {
  try {
    const tfr = new FittingRoom(shopId, modalDivId, sizeRecMainDivId, vtoMainDivId, noCacheOnRetry, hooks, cssVariables, env)
    return tfr
  } catch (e) {
    console.error("failed to init FittingRoom", e)
    return Promise.reject(e)
  }
}