import { FittingRoomController, TFRHooks } from './tfr'
import { TFRCssVariables as TFRCSSVariables } from './components/SizeRecommendationController'

export type TFR = {
  env?: string
  shopId: number
  styleSKU: string,
  noCacheOnRetry?: boolean // Enable VTO retry with cache bypass
  modalDivId: string
  sizeRecMainDivId: string
  vtoMainDivId: string
  cssVariables?: TFRCSSVariables
  hooks?: TFRHooks
}

export const initFittingRoom = async ({
  env,
  shopId,
  styleSKU,
  modalDivId,
  sizeRecMainDivId,
  vtoMainDivId,
  noCacheOnRetry = false,
  hooks = {},
  cssVariables = {},
}: TFR): Promise<FittingRoomController> => {
  try {
    const tfr = new FittingRoomController(env,
      shopId,
      styleSKU,
      noCacheOnRetry,
      modalDivId,
      sizeRecMainDivId,
      vtoMainDivId,
      cssVariables,
      hooks)
    return tfr
  } catch (e) {
    throw new Error("failed to init FittingRoom: " + e)
  }
}