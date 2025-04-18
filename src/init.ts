import { FittingRoom, TfrHooks } from './tfr'
import { TfrCssVariables } from './tfr-size-rec'

export type TrfConfig = {
  shopId: string | number
  modalDivId: string
  sizeRecMainDivId: string
  vtoMainDivId: string
  hooks?: TfrHooks
  cssVariables?: TfrCssVariables
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
