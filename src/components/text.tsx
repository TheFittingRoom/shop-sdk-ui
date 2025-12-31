import { forwardRef } from 'react'
import { useTranslation } from '@/lib/locale'
import { CssProperties, useVariantCss } from '@/lib/theme'

export type TextVariant = 'base' | 'brand' | 'error'

export interface TextProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant: TextVariant
  css?: CssProperties
}

export const Text = forwardRef<HTMLSpanElement, TextProps>(({ children, variant, css, ...props }, ref) => {
  const variantCss = useVariantCss<TextVariant>(variant, (theme) => ({
    base: {
      color: theme.color_fg_text,
      fontFamily: 'sans-serif',
      fontSize: '14px',
    },
    brand: {
      color: theme.color_fg_text,
      fontFamily: theme.brand_font_family,
      fontSize: '14px',
    },
    error: {
      color: theme.color_danger,
      fontSize: '14px',
    },
  }))
  return (
    <span ref={ref} css={[variantCss, css]} {...props}>
      {children}
    </span>
  )
})
Text.displayName = 'Text'

export interface TextTProps extends Omit<TextProps, 'children'> {
  t: string
  vars?: Record<string, string | number>
}

export function TextT({ t, vars, ...props }: TextTProps) {
  const { t: translate } = useTranslation()
  const translatedText = translate(t, vars)
  return (
    <Text {...props}>
      {translatedText}
    </Text>
  )
}
