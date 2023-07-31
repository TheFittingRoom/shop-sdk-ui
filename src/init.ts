import { FittingRoom, TfrHooks } from './tfr'

export const initFittingRoom = async (
  shopId: string | number,
  modalDivId: string,
  hooks: TfrHooks,
  env: string = 'dev',
) => {
  const tfr = new FittingRoom(shopId, modalDivId, hooks, env)
  await tfr.onInit()

  return tfr
}
