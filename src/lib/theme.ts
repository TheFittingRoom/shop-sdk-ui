import { useMemo } from 'react'
import { CSSProperties } from 'react'

export interface ThemeData {
  color_fg_text: string
}
export const themeData: ThemeData = {
  color_fg_text: '#21201F',
}

export function getThemeData(): ThemeData {
  return themeData
}
export function setThemeData(newThemeData: Partial<ThemeData>) {
  Object.assign(themeData, newThemeData)
}

export function useStyles<T extends Record<string, CSSProperties>>(callback: (themeData: ThemeData) => T) {
  return useMemo(() => callback(themeData), [])
}
