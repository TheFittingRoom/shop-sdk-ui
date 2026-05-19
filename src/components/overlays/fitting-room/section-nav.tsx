import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/button'
import { useCss } from '@/lib/theme'
import { Chevron } from './chevron'

export interface SectionNavItem {
  name: string
  label: string
}

interface SectionNavProps {
  sections: SectionNavItem[]
  // Name of the section currently scrolled to the top of the viewport.
  activeName: string | null
  // Scroll the named section into view (anchor-link style).
  onSelect: (name: string) => void
}

// Hamburger menu icon — three horizontal lines. Inline SVG using
// currentColor so it inherits the pill's text colour, like Chevron.
function MenuIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M4 7H20M4 12H20M4 17H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

// SectionNav is the dark jump-to-section control at the top of the mobile
// browse view. It shows the section currently at the top of the scroll
// viewport; tapping opens a drop-down of every section that scroll-jumps to
// the chosen one. The dark shade sets it apart from the section content below.
export function SectionNav({ sections, activeName, onSelect }: SectionNavProps) {
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  // Click-outside dismisses the drop-down.
  useEffect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  const handleSelect = useCallback(
    (name: string) => {
      setOpen(false)
      onSelect(name)
    },
    [onSelect],
  )

  const css = useCss((theme) => ({
    wrapper: {
      // Floats over the card rails at the top-right instead of taking its own
      // row in the browse-view column (BrowseView's container is relative).
      position: 'absolute',
      top: '12px',
      right: '16px',
      // Above the rails so the pill and its drop-down sit over the content.
      zIndex: 5,
    },
    bar: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '8px',
      padding: '6px 16px',
      borderRadius: '999px',
      backgroundColor: theme.color_fg_text,
      color: '#FFFFFF',
      border: 'none',
      cursor: 'pointer',
      fontSize: '13px',
      fontWeight: '500',
      letterSpacing: '0.5px',
      textTransform: 'uppercase',
      whiteSpace: 'nowrap',
    },
    icon: {
      display: 'inline-flex',
      alignItems: 'center',
      flex: 'none',
    },
    dropdown: {
      position: 'absolute',
      top: 'calc(100% + 6px)',
      right: 0,
      // At least as wide as the pill, growing to fit the longest label.
      minWidth: '100%',
      backgroundColor: theme.color_fg_text,
      borderRadius: '16px',
      maxHeight: '60vh',
      overflowY: 'auto',
      boxShadow: '0 6px 16px rgba(0, 0, 0, 0.25)',
    },
    item: {
      display: 'block',
      width: '100%',
      textAlign: 'left',
      whiteSpace: 'nowrap',
      padding: '8px 18px',
      backgroundColor: 'transparent',
      color: '#FFFFFF',
      border: 'none',
      cursor: 'pointer',
      fontSize: '13px',
      letterSpacing: '0.5px',
      textTransform: 'uppercase',
      '&:not(:first-of-type)': {
        borderTop: '1px solid rgba(255, 255, 255, 0.12)',
      },
    },
    itemActive: {
      backgroundColor: 'rgba(255, 255, 255, 0.16)',
    },
  }))

  const activeLabel = sections.find((s) => s.name === activeName)?.label ?? sections[0]?.label ?? ''

  return (
    <div ref={wrapperRef} css={css.wrapper}>
      <Button variant="base" css={css.bar} onClick={() => setOpen((o) => !o)}>
        <span>{activeLabel}</span>
        <span css={css.icon}>
          {open ? <Chevron direction="up" size={20} /> : <MenuIcon size={20} />}
        </span>
      </Button>
      {open ? (
        <div css={css.dropdown}>
          {sections.map((s) => (
            <Button
              key={s.name}
              variant="base"
              css={s.name === activeName ? { ...css.item, ...css.itemActive } : css.item}
              onClick={() => handleSelect(s.name)}
            >
              {s.label}
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
