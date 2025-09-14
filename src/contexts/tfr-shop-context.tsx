import type { TfrShop } from '@thefittingroom/sdk'
import { createContext } from 'preact'
import { useContext } from 'preact/hooks'

export type TfrShopContextValue = TfrShop

export const TfrShopContext = createContext<TfrShopContextValue | null>(null)

export const TfrShopProvider = TfrShopContext.Provider
export const useTfrShopContext = (): TfrShopContextValue => {
  const context = useContext(TfrShopContext)
  if (!context) throw new Error('useTfrShopContext must be used within TfrShopProvider')

  return context
}
