import { StyleCategory, StyleCategoryGroup } from '@/api/gen/responses'
import { getStyleCategories, getStyleCategoryGroups } from '@/lib/api'
import { getLogger } from '@/lib/logger'

export type { StyleCategory, StyleCategoryGroup }

// StyleCategoryIndex bundles the two style-category endpoints into a single
// helper object the overlay can use to look up category metadata and group
// affiliation by name. Built once per session.
export interface StyleCategoryIndex {
  byName(name: string): StyleCategory | null
  groupByName(name: string): StyleCategoryGroup | null
  groupForCategory(categoryName: string): StyleCategoryGroup | null
  groupsInOrder(): StyleCategoryGroup[]
  raw: { categories: StyleCategory[]; groups: StyleCategoryGroup[] }
}

const logger = getLogger('style-categories')

let cached: StyleCategoryIndex | null = null
let inflight: Promise<StyleCategoryIndex> | null = null

function buildIndex(categories: StyleCategory[], groups: StyleCategoryGroup[]): StyleCategoryIndex {
  const categoryMap = new Map<string, StyleCategory>()
  for (const c of categories) {
    categoryMap.set(String(c.name), c)
  }
  const groupMap = new Map<string, StyleCategoryGroup>()
  for (const g of groups) {
    groupMap.set(g.name, g)
  }
  return {
    byName(name: string) {
      return categoryMap.get(name) ?? null
    },
    groupByName(name: string) {
      return groupMap.get(name) ?? null
    },
    groupForCategory(categoryName: string) {
      const cat = categoryMap.get(categoryName)
      if (!cat) {
        return null
      }
      return groupMap.get(cat.group) ?? null
    },
    groupsInOrder() {
      return [...groups].sort((a, b) => a.display_order - b.display_order)
    },
    raw: { categories, groups },
  }
}

// loadStyleCategoryIndex returns the cached index after first call. Concurrent
// callers during the initial fetch share the same in-flight promise.
export async function loadStyleCategoryIndex(): Promise<StyleCategoryIndex> {
  if (cached) {
    return cached
  }
  if (inflight) {
    return inflight
  }
  inflight = (async () => {
    try {
      logger.logDebug('{{ts}} - Loading style-category index')
      const [categories, groups] = await Promise.all([getStyleCategories(), getStyleCategoryGroups()])
      cached = buildIndex(categories, groups)
      return cached
    } finally {
      inflight = null
    }
  })()
  return inflight
}

// peekStyleCategoryIndex returns the cached index synchronously, or null if
// the loader hasn't run yet. Used by hooks that want to render whatever's
// available without waiting.
export function peekStyleCategoryIndex(): StyleCategoryIndex | null {
  return cached
}
