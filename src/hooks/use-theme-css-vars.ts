import { useEffect, useRef } from 'preact/hooks'

export interface ThemeCssVariables {
  // Colors
  brandColor?: string
  black?: string
  red?: string
  white?: string
  muted?: string
  dark?: string
  grey?: string
  lightGrey?: string

  // Borders
  mainBorderColor?: string
  mainBorderRadius?: string
  mainBorderWidth?: string

  // Main container
  mainBgColor?: string
  mainWidth?: string
  mainVPadding?: string
  mainHPadding?: string

  // Typography
  mainFont?: string
  titleFont?: string
  subtitleFont?: string
  rowFont?: string
  ctaFont?: string

  // Size selector
  sizeSelectorTextColor?: string
  sizeSelectorFontSize?: string
  sizeSelectorFontWeight?: string
  sizeSelectorBorderColor?: string
  sizeSelectorBorderWidth?: string
  sizeSelectorBgColor?: string
  sizeSelectorBgColorHover?: string
  sizeSelectorBgColorActive?: string
  sizeSelectorButtonHeight?: string
  sizeSelectorButtonActiveHeight?: string
  sizeSelectorButtonActiveBorderColor?: string
  sizeSelectorButtonActiveBorderWidth?: string
  sizeSelectorButtonRadius?: string
  sizeSelectorButtonShadow?: string
}

const defaultTheme: ThemeCssVariables = {
  // Colors
  brandColor: '#000000',
  black: '#000000',
  red: '#FF0000',
  white: '#FFFFFF',
  muted: '#6C757D',
  dark: '#343A40',
  grey: '#6C757D',
  lightGrey: '#F8F9FA',

  // Borders
  mainBorderColor: '#E0E0E0',
  mainBorderRadius: '8px',
  mainBorderWidth: '1px',

  // Main container
  mainBgColor: '#FFFFFF',
  mainWidth: '100%',
  mainVPadding: '16px',
  mainHPadding: '16px',

  // Typography
  mainFont: '14px/1.5 system-ui, -apple-system, sans-serif',
  titleFont: '18px/1.2 system-ui, -apple-system, sans-serif',
  subtitleFont: '16px/1.3 system-ui, -apple-system, sans-serif',
  rowFont: '14px/1.5 system-ui, -apple-system, sans-serif',
  ctaFont: '14px/1.5 system-ui, -apple-system, sans-serif',

  // Size selector
  sizeSelectorTextColor: '#000000',
  sizeSelectorFontSize: '14px',
  sizeSelectorFontWeight: '500',
  sizeSelectorBorderColor: '#E0E0E0',
  sizeSelectorBorderWidth: '1px',
  sizeSelectorBgColor: '#FFFFFF',
  sizeSelectorBgColorHover: '#F8F9FA',
  sizeSelectorBgColorActive: '#000000',
  sizeSelectorButtonHeight: '40px',
  sizeSelectorButtonActiveHeight: '40px',
  sizeSelectorButtonActiveBorderColor: '#000000',
  sizeSelectorButtonActiveBorderWidth: '2px',
  sizeSelectorButtonRadius: '4px',
  sizeSelectorButtonShadow: 'none',
}

const setCssVariables = (cssVars: Record<string, string>, styleRef: HTMLElement): void => {
  let style = ''
  Object.entries(cssVars).forEach(([key, value]) => {
    style += `${key}: ${value};`
  })

  styleRef.textContent = style
}

export const useThemeCssVars = (customVariables?: ThemeCssVariables): void => {
  const styleRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!styleRef.current) {
      styleRef.current = document.createElement('style')
      const firstStyleChild = document.head.querySelectorAll('style')[0]
      document.head.insertBefore(styleRef.current, firstStyleChild)
    }

    const mergedVars = { ...defaultTheme, ...customVariables }

    const cssVars: Record<string, string> = {}
    Object.entries(mergedVars).forEach(([key, value]) => {
      if (value !== undefined) {
        const cssVarName = `--tfr-${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`
        cssVars[cssVarName] = value
      }
    })

    setCssVariables(cssVars, styleRef.current)
  }, [customVariables])
}
