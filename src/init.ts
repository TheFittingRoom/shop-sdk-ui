import { TFRCssVariables as TFRCSSVariables } from './components/SizeRecommendationController'
import { FittingRoomController, TFRHooks } from './tfr'

export type TFR = {
  env?: string
  shopId: number
  externalID: string
  noCacheOnRetry: boolean // Enable VTO retry with cache bypass
  modalDivId: string
  sizeRecMainDivId: string
  vtoMainDivId: string
  cssVariables?: TFRCSSVariables
  hooks?: TFRHooks
}

export const initFittingRoom = async ({
  env,
  shopId,
  externalID,
  modalDivId,
  sizeRecMainDivId,
  vtoMainDivId,
  noCacheOnRetry = false,
  hooks = {},
  cssVariables = {},
}: TFR): Promise<FittingRoomController> => {
  try {
    const tfr = new FittingRoomController(
      env,
      shopId,
      String(externalID),
      noCacheOnRetry,
      modalDivId,
      sizeRecMainDivId,
      vtoMainDivId,
      cssVariables,
      hooks,
    )
    await tfr.Init()
    return tfr
  } catch (e) {
    throw new Error('failed to init FittingRoom: ' + e)
  }
}
