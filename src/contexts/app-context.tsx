import type { ThemeCssVariables } from '@hooks/use-theme-css-vars'
import { createContext } from 'preact'
import { useContext } from 'preact/hooks'

export interface AppConfig {
  theme?: ThemeCssVariables
}

const AppContext = createContext<AppConfig>({})

export const AppProvider = AppContext.Provider
export const useAppConfig = (): AppConfig => {
  const context = useContext(AppContext)
  if (!context) throw new Error('useAppConfig must be used within AppProvider')

  return context
}
