import type { TfrShop } from '@thefittingroom/sdk'

import type { ThemeCssVariables } from './hooks'

export interface FittingRoomHandle {
  setSku: (sku: string) => void
  setStyleId: (styleId: number) => void
  setBrandUserId: (userId: string) => void
}

export interface FittingRoomState {
  tfrShop: TfrShop
  config: {
    theme?: ThemeCssVariables
  }
}

class StateManager {
  private static instance: StateManager | null = null
  private state: FittingRoomState | null = null

  static getInstance(): StateManager {
    if (!StateManager.instance) StateManager.instance = new StateManager()
    return StateManager.instance
  }

  initialize(tfrShop: TfrShop, config: FittingRoomState['config']): void {
    this.state = {
      tfrShop,
      config,
    }
  }

  getState(): FittingRoomState | null {
    return this.state
  }

  createHandle(): FittingRoomHandle {
    return {
      setSku: (sku: string) => {
        window.dispatchEvent(new CustomEvent('fittingroom:setSku', { detail: { sku } }))
      },
      setStyleId: (styleId: number) => {
        window.dispatchEvent(new CustomEvent('fittingroom:setStyleId', { detail: { styleId } }))
      },
      setBrandUserId: (userId: string) => {
        this.state?.tfrShop.user.setBrandUserId(userId)
      },
    }
  }

  reset(): void {
    this.state = null
  }
}

export const stateManager = StateManager.getInstance()

export const createHandle = (): FittingRoomHandle => {
  return stateManager.createHandle()
}
