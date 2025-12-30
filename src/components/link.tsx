import { forwardRef } from 'react'
import { CssProperties, useVariantCss } from '@/lib/theme'

export type LinkVariant = 'base' | 'brand' | 'underline' | 'semibold'

export interface LinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  variant: LinkVariant
  css?: CssProperties
}

export const Link = forwardRef<HTMLAnchorElement, LinkProps>(({ children, variant, css, ...props }, ref) => {
  const variantCss = useVariantCss<LinkVariant>(variant, (theme) => ({
    base: {
      cursor: 'pointer !important',
      color: theme.color_fg_text,
      fontSize: '14px',
      textDecoration: 'none',
    },
    brand: {
      cursor: 'pointer !important',
      color: theme.color_fg_text,
      fontSize: '14px',
      textDecoration: 'underline',
    },
    underline: {
      cursor: 'pointer !important',
      color: theme.color_fg_text,
      fontSize: '14px',
      textDecoration: 'underline',
    },
    semibold: {
      cursor: 'pointer !important',
      color: theme.color_fg_text,
      fontSize: '14px',
      fontWeight: 600,
      textDecoration: 'none',
    },
  }))
  return (
    <a ref={ref} css={[variantCss, css]} {...props}>
      {children}
    </a>
  )
})
Link.displayName = 'Link'
