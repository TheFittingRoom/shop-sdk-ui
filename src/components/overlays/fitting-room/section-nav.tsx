import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
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

// When jumping to a section, stop this far short of the very top so the
// floating pills don't sit over the section title.
const SECTION_SCROLL_TOP_GAP_PX = 50

// useSectionNav drives a SectionNav over a scrolling column of sections (the
// card rails, on mobile browse and desktop): which section is current, and
// jumping to one. Attach `scrollerRef` and `onScroll` to the scrolling element
// and `sectionRef(name)` to each section's wrapper.
//
// The current section is the topmost one whose top edge is still at or below
// the scroller's top — the section whose start is still visible. Once a
// section's top scrolls above the fold it's no longer current; the next one
// takes over. When every section's top has scrolled off (deep in the last
// section), the last section stays current.
export function useSectionNav(sections: SectionNavItem[]) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const sectionEls = useRef<Map<string, HTMLDivElement>>(new Map())
  const [activeName, setActiveName] = useState<string | null>(null)
  const lastName = sections.length > 0 ? sections[sections.length - 1].name : null

  const onScroll = useCallback(() => {
    const container = scrollerRef.current
    if (!container) {
      return
    }
    const containerTop = container.getBoundingClientRect().top
    let active: string | null = null
    for (const [name, el] of sectionEls.current) {
      if (el.getBoundingClientRect().top >= containerTop - 1) {
        active = name
        break
      }
    }
    setActiveName(active ?? lastName)
  }, [lastName])

  const sectionKey = sections.map((s) => s.name).join('|')
  useLayoutEffect(() => {
    onScroll()
  }, [onScroll, sectionKey])

  const scrollToSection = useCallback((name: string) => {
    const container = scrollerRef.current
    const el = sectionEls.current.get(name)
    if (!container || !el) {
      return
    }
    const delta = el.getBoundingClientRect().top - container.getBoundingClientRect().top
    container.scrollBy({ top: delta - SECTION_SCROLL_TOP_GAP_PX, behavior: 'smooth' })
  }, [])

  const sectionRef = useCallback(
    (name: string) => (el: HTMLDivElement | null) => {
      if (el) {
        sectionEls.current.set(name, el)
      } else {
        sectionEls.current.delete(name)
      }
    },
    [],
  )

  return { scrollerRef, sectionRef, onScroll, activeName, scrollToSection }
}

// SectionNav is the dark jump-to-section control over the fitting room's card
// rails (mobile browse view and desktop card pane). It shows the section
// currently at the top of the scroll viewport; tapping opens a drop-down of
// every section that scroll-jumps to the chosen one. The dark shade sets it
// apart from the section content below. It doesn't place itself: the layouts
// float it top-right, beside the "Create your Mini Me" pill (TopRightPills).
export function SectionNav({ sections, activeName, onSelect }: SectionNavProps) {
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  // Click-outside dismisses the drop-down.
  useEffect(() => {
    if (!open) {
      return
    }
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
      // Positions the drop-down.
      position: 'relative',
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
    <div ref={wrapperRef} css={css.wrapper} data-testid="section-nav">
      <Button variant="base" css={css.bar} onClick={() => setOpen((o) => !o)}>
        <span>{activeLabel}</span>
        <span css={css.icon}>{open ? <Chevron direction="up" size={20} /> : <MenuIcon size={20} />}</span>
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
