import type { CSSProperties } from 'react'
import { useMemo } from 'react'
import type { CSSObject } from '@emotion/react'
import { keyframes } from '@emotion/react'

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
  brand_font_family: "'Inter', sans-serif",
  brand_link_text_decoration: 'underline',
  brand_button_background_color: '#FFA273',
  brand_button_text_color: '#21201F',
  color_danger: '#900B09',
  color_fg_text: '#21201F',
  color_tfr_800: '#265A64',
  font_family: "'Inter', sans-serif",
}

export function _init(initThemeData: Partial<ThemeData> | null) {
  if (initThemeData) {
    Object.assign(themeData, initThemeData)
  }
}

export function getThemeData(): ThemeData {
  return themeData
}

export type CssProp = CSSObject
export type StyleProp = CSSProperties

export { keyframes }

// Memoized on mount with no deps — callback runs once and its result is
// frozen. Closures over component state or props won't update. For style
// values that need to react to state (e.g. dynamic grid template), apply
// them via inline `style` instead of routing through useCss.
/* eslint-disable react-hooks/exhaustive-deps -- both functions intentionally
   memoize once on mount; the callback identity is ignored on purpose so that
   `useCss((theme) => ({...}))` doesn't re-run every render. See useCss
   docstring above. Reactive style values must use inline `style` instead. */
export function useCss<T extends Record<string, CssProp>>(callback: (themeData: ThemeData) => T): T {
  return useMemo(() => callback(themeData), [])
}

export function useVariantCss<T extends string, U extends Record<T, CssProp> = Record<T, CssProp>>(
  variant: T,
  callback: (themeData: ThemeData) => U,
): CssProp {
  return useMemo(() => {
    const variants = callback(themeData)
    return variants[variant]
  }, [variant])
}
/* eslint-enable react-hooks/exhaustive-deps */
