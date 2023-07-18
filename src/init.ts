import { FittingRoom, TfrHooks } from './tfr'

export const initFittingRoom = (shopId: string | number, modalDivId: string, hooks: TfrHooks) =>
  new FittingRoom(shopId, modalDivId, hooks)
