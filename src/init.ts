import { FittingRoom, TfrHooks } from './tfr'

export const initFittingRoom = async (
  shopId: string | number,
  modalDivId: string,
  sizeRecMainDivId: string,
  hooks: TfrHooks,
  env: string = 'dev',
) => {
  const tfr = new FittingRoom(shopId, modalDivId, sizeRecMainDivId, hooks, env)
  await tfr.onInit()

  return tfr
}
