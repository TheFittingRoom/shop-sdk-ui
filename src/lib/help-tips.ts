import { useCallback, useEffect, useId, useSyncExternalStore } from 'react'
import { getLogger } from '@/lib/logger'

const logger = getLogger('help-tips')

// HelpTipId names one help popup. The order of HELP_TIP_PRIORITY is the order
// popups are offered in when more than one is waiting: only one is ever on
// screen, and the next appears once it is dismissed.
export type HelpTipId =
  // Store widgets.
  | 'fitting_room_icon'
  | 'add_to_fitting_room'
  // Fitting room.
  | 'fitting_room_card'
  | 'fitting_room_try_it_on'
  // Avatar frame, fitting room and quick view.
  | 'avatar_rotate'
  // Fitting room mobile try-on view.
  | 'sheet_swipe_up'
  | 'sheet_expand_item'
  | 'try_on_back'
  // Fitting room desktop detail pane.
  | 'detail_expand_item'

const HELP_TIP_PRIORITY: HelpTipId[] = [
  // The hanger before the header icon: adding something comes before
  // viewing what was added.
  'add_to_fitting_room',
  'fitting_room_icon',
  'fitting_room_card',
  'fitting_room_try_it_on',
  'avatar_rotate',
  'sheet_swipe_up',
  'sheet_expand_item',
  // Last on mobile: getting back to the cards matters once the try-on view
  // has been explored.
  'try_on_back',
  // Desktop: after the cards and arrows, the collapsed rows.
  'detail_expand_item',
]

// Every popup the browser has seen, one flag each:
//   { "fitting_room_card": true, "avatar_rotate": true, ... }
// Per browser, not per shopper — the store-widget popups show to signed-out
// visitors too, and a shopper who signs in on the same browser has still seen
// them.
const STORAGE_KEY = 'tfr:help-tips:v1'

// The two store-widget popups predate STORAGE_KEY and kept a flag each.
// Honour those so a returning visitor isn't shown them again.
const LEGACY_KEYS: Partial<Record<HelpTipId, string>> = {
  fitting_room_icon: 'tfr:first-visit-tooltip-seen:v1',
  add_to_fitting_room: 'tfr:first-add-tooltip-seen:v1',
}

function readSeen(): Set<HelpTipId> {
  const seen = new Set<HelpTipId>()
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : null
    if (parsed && typeof parsed === 'object') {
      for (const [id, value] of Object.entries(parsed)) {
        if (value === true) {
          seen.add(id as HelpTipId)
        }
      }
    }
    for (const [id, key] of Object.entries(LEGACY_KEYS)) {
      if (window.localStorage.getItem(key)) {
        seen.add(id as HelpTipId)
      }
    }
  } catch (error) {
    logger.logWarn('Failed to read help tips', { error })
  }
  return seen
}

function writeSeen(seen: Set<HelpTipId>) {
  try {
    const record: Record<string, true> = {}
    for (const id of seen) {
      record[id] = true
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(record))
  } catch (error) {
    logger.logWarn('Failed to write help tips', { error })
  }
}

// --- Coordinator ----------------------------------------------------------
//
// Each mounted popup that could show registers a request (instance → tip).
// The active popup is the highest-priority requested tip not yet seen, owned
// by the first instance that asked for it — several hangers on a catalogue
// page all request add_to_fitting_room, and only one of them shows it.

let seenCache: Set<HelpTipId> | null = null
const requests = new Map<string, HelpTipId>()
const listeners = new Set<() => void>()
let activeOwner: string | null = null
let recomputeTimer: number | null = null

// Popups that become eligible together — the store widgets, each its own
// React root, mount one after another in the same page load — are batched
// for this long, so priority decides between them rather than mount order.
const REQUEST_BATCH_MS = 100

function scheduleRecompute() {
  if (recomputeTimer !== null) {
    return
  }
  recomputeTimer = window.setTimeout(() => {
    recomputeTimer = null
    recompute()
  }, REQUEST_BATCH_MS)
}

function seen(): Set<HelpTipId> {
  if (!seenCache) {
    seenCache = readSeen()
  }
  return seenCache
}

function recompute() {
  const seenIds = seen()
  // A popup on screen stays until it is dismissed or its anchor goes away —
  // a higher-priority one becoming eligible (frames arriving, say) waits its
  // turn rather than swapping it out from under the shopper.
  const current = activeOwner ? requests.get(activeOwner) : undefined
  let next: string | null = current && !seenIds.has(current) ? activeOwner : null
  for (const id of next ? [] : HELP_TIP_PRIORITY) {
    if (seenIds.has(id)) {
      continue
    }
    for (const [owner, requested] of requests) {
      if (requested === id) {
        next = owner
        break
      }
    }
    if (next) {
      break
    }
  }
  if (next !== activeOwner) {
    activeOwner = next
    for (const listener of listeners) {
      listener()
    }
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function getActiveOwner() {
  return activeOwner
}

// markHelpTipSeen records a popup as seen and moves on to the next one.
export function markHelpTipSeen(id: HelpTipId) {
  const seenIds = seen()
  if (seenIds.has(id)) {
    return
  }
  seenIds.add(id)
  writeSeen(seenIds)
  recompute()
}

export interface HelpTipHandle {
  // This instance's popup is the one on screen.
  show: boolean
  // Record the popup as seen and hide it. Safe to call when not shown.
  dismiss: () => void
}

// A popup that has been up this long has been seen, and the next one (if
// any) can take its place. Shared by every popup, overlay and store widget.
export const HELP_TIP_AUTO_DISMISS_MS = 4000

// How long a popup waits once it could show. Gives a freshly mounted or
// re-laid-out anchor time to settle, and spaces out a run of popups.
const DEFAULT_SHOW_DELAY_MS = 500

// useHelpTip asks for a popup while `enabled` is true — i.e. while its anchor
// is on screen and the hint makes sense. It returns whether this instance's
// popup is the one showing. Seen popups never show again in this browser.
export function useHelpTip(id: HelpTipId, enabled: boolean, delayMs: number = DEFAULT_SHOW_DELAY_MS): HelpTipHandle {
  const owner = useId()
  const active = useSyncExternalStore(subscribe, getActiveOwner)

  useEffect(() => {
    if (!enabled || seen().has(id)) {
      return
    }
    const register = () => {
      requests.set(owner, id)
      scheduleRecompute()
    }
    const timer = delayMs > 0 ? window.setTimeout(register, delayMs) : null
    if (timer === null) {
      register()
    }
    return () => {
      if (timer !== null) {
        window.clearTimeout(timer)
      }
      if (requests.delete(owner)) {
        recompute()
      }
    }
  }, [id, enabled, delayMs, owner])

  const show = enabled && active === owner
  const dismiss = useCallback(() => markHelpTipSeen(id), [id])
  return { show, dismiss }
}
