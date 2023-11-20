import { FittingRoom, TfrHooks } from './tfr'

export const initFittingRoom = async (
  shopId: string | number,
  modalDivId: string,
  hooks: TfrHooks,
  tryOnEnabled: boolean = false,
  env: string = 'dev',
) => {
  const tfr = new FittingRoom(shopId, modalDivId, hooks, tryOnEnabled, env)
  await tfr.onInit()

  return tfr
}
