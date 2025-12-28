import { useMemo } from 'react'
import { CSSProperties } from 'react'
import { EnvName, getConfig } from '@/lib/config'

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

let assetBaseUrl: string

export function _init(environment: EnvName, initThemeData: Partial<ThemeData> | null) {
  const config = getConfig(environment)
  assetBaseUrl = config.asset.baseUrl

  if (initThemeData) {
    Object.assign(themeData, initThemeData)
  }
}

export function getThemeData(): ThemeData {
  return themeData
}

export function useStyles<T extends Record<string, CSSProperties>>(callback: (themeData: ThemeData) => T) {
  return useMemo(() => callback(themeData), [])
}

export function getAssetUrl(fileName: string): string {
  return `${assetBaseUrl}/${fileName}`
}
