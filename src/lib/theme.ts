import { useMemo, CSSProperties } from 'react'
import { keyframes, CSSObject } from '@emotion/react'

export interface ThemeData {
  brand_font_family: string
  brand_link_text_decoration: string
  brand_button_background_color: string
  brand_button_text_color: string
  color_danger: string
  color_fg_text: string
  color_tfr_800: string
  font_family: string
}
export const themeData: ThemeData = {
  brand_font_family: 'TN web use only, Times New Roman, serif',
  brand_link_text_decoration: 'underline',
  brand_button_background_color: '#FFA273',
  brand_button_text_color: '#21201F',
  color_danger: '#900B09',
  color_fg_text: '#21201F',
  color_tfr_800: '#265A64',
  font_family: 'sans-serif',
}

export function _init(initThemeData: Partial<ThemeData> | null) {
  if (initThemeData) {
    Object.assign(themeData, initThemeData)
  }
}

export function getThemeData(): ThemeData {
  return themeData
}

export type CssProperties = CSSObject
export type StyleProperties = CSSProperties

export { keyframes }

export function useCss<T extends Record<string, CssProperties>>(callback: (themeData: ThemeData) => T): T {
  return useMemo(() => callback(themeData), [])
}

export function useVariantCss<T extends string, U extends Record<T, CssProperties> = Record<T, CssProperties>>(
  variant: T,
  callback: (themeData: ThemeData) => U,
): CssProperties {
  return useMemo(() => {
    const variants = callback(themeData)
    return variants[variant]
  }, [variant])
}
