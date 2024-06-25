import { FittingRoom, TfrHooks } from './tfr'
import { TfrCssVariables } from './tfr-size-rec'

export const initFittingRoom = async (
  shopId: string | number,
  modalDivId: string,
  sizeRecMainDivId: string,
  hooks: TfrHooks = {},
  cssVariables: TfrCssVariables = {},
  env: string = 'dev',
) => {
  const tfr = new FittingRoom(shopId, modalDivId, sizeRecMainDivId, hooks, cssVariables, env)
  await tfr.onInit()

  return tfr
}
