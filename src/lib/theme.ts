import { useMemo } from 'react'
import { Interpolation, Theme } from '@emotion/react'

export interface ThemeData {
  color_fg_text: string
  color_modal_bg: string
  color_modal_border: string
}
export const themeData: ThemeData = {
  color_fg_text: '#21201F',
  color_modal_bg: '#FFFFFF',
  color_modal_border: '#265A64',
}

export function _init(initThemeData: Partial<ThemeData> | null) {
  if (initThemeData) {
    Object.assign(themeData, initThemeData)
  }
}

export function getThemeData(): ThemeData {
  return themeData
}

export type EmotionCssProperties = Interpolation<Theme>

export function useCss<T extends Record<string, EmotionCssProperties>>(callback: (themeData: ThemeData) => T): T {
  return useMemo(() => callback(themeData), [])
}

export function useVariantCss<T extends string, U extends Record<T, EmotionCssProperties> = Record<T, EmotionCssProperties>>(
  variant: T,
  callback: (themeData: ThemeData) => U,
): EmotionCssProperties {
  return useMemo(() => {
    const variants = callback(themeData)
    return variants[variant]
  }, [variant])
}
