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
      flex: 'none',
      position: 'relative',
      // Above the rails so the drop-down covers the section content below.
      zIndex: 5,
    },
    bar: {
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '8px',
      padding: '12px 16px',
      backgroundColor: theme.color_fg_text,
      color: '#FFFFFF',
      border: 'none',
      cursor: 'pointer',
      fontSize: '13px',
      fontWeight: '500',
      letterSpacing: '0.5px',
      textTransform: 'uppercase',
    },
    chevron: {
      display: 'inline-flex',
      alignItems: 'center',
      flex: 'none',
    },
    dropdown: {
      position: 'absolute',
      top: '100%',
      left: 0,
      right: 0,
      backgroundColor: theme.color_fg_text,
      maxHeight: '60vh',
      overflowY: 'auto',
      boxShadow: '0 6px 16px rgba(0, 0, 0, 0.25)',
    },
    item: {
      width: '100%',
      display: 'block',
      textAlign: 'left',
      padding: '12px 16px',
      backgroundColor: 'transparent',
      color: '#FFFFFF',
      border: 'none',
      borderTop: '1px solid rgba(255, 255, 255, 0.12)',
      cursor: 'pointer',
      fontSize: '13px',
      letterSpacing: '0.5px',
      textTransform: 'uppercase',
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
        <span css={css.chevron}>
          <Chevron direction={open ? 'up' : 'down'} size={20} />
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
