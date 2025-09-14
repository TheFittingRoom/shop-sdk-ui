import type { ThemeCssVariables } from '@hooks/use-theme-css-vars'
import type { TfrShop } from '@thefittingroom/sdk'
import { createContext } from 'preact'
import { useContext } from 'preact/hooks'

export interface FittingRoomContextValue {
  tfrShop: TfrShop
  theme?: ThemeCssVariables
}

export const FittingRoomContext = createContext<FittingRoomContextValue | null>(null)

export const useFittingRoom = (): FittingRoomContextValue => {
  const context = useContext(FittingRoomContext)
  if (!context) {
    throw new Error('useFittingRoom must be used within a FittingRoomProvider')
  }
  return context
}
