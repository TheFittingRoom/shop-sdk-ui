import { FittingRoom, TfrHooks } from './tfr'

export const initFittingRoom = async (shopId: string | number, modalDivId: string, hooks: TfrHooks) => {
  const tfr = new FittingRoom(shopId, modalDivId, hooks)
  await tfr.onInit()

  return tfr
}
