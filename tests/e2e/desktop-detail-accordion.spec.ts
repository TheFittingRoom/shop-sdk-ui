import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { bootSdk } from './helpers/boot'
import {
  TEST_BRAND_ID,
  TEST_PRODUCT_EXTERNAL_ID,
  TEST_PRODUCT_HANDLE,
  TEST_SEEDED_STYLE,
  TEST_SIZE_FIT_RECOMMENDATION,
  TEST_UID,
  TEST_VTO_COMPOSITION,
} from './fixtures/seed'

// WEB-13: the desktop middle pane's collapsed accordion rows carry the product
// name and a size selector, so a garment can be re-sized without opening it.
//
// The load-bearing detail is that the size pills sit OUTSIDE the header
// button. The header is the section toggle and spans the row, so pills nested
// inside it would collapse or expand the section on every size change — which
// is both wrong and, because the section then re-renders, easy to mistake for
// the size change simply not working.

const TSHIRT_CATEGORY = {
  name: 'tshirt',
  label: 'T-Shirts',
  label_singular: 'Top',
  group: 'tops',
  layer_order: 10,
  tuckable: false,
  layer_order_untucked: 10,
  sleeve_selection: 'not_applicable',
  measurement_locations: [],
  additional_locations_full_sleeves: [],
  includes: [],
  excludes: [],
  is_container: false,
}
const TOPS_GROUP = { name: 'tops', label: 'Tops', same_group_default: 'exclude', display_order: 1 }

// `vtoItems`, when passed, collects the items of every VTO request. Captured
// through bootSdk's own override rather than a separate page.route: Playwright
// matches routes most-recently-registered first, so a handler installed before
// bootSdk is shadowed by the ones it installs and never runs.
async function bootDesktopFittingRoom(page: Page, vtoItems?: { colorway_size_asset_id: number }[][]) {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.addInitScript(
    ({ brandId, uid, externalId, handle }) => {
      const item = { externalId, handle, size: 'M', color: 'Blue', colorwaySizeAssetId: null, addedAt: 1 }
      window.localStorage.setItem('tfr:fitting-room:v1', JSON.stringify({ [String(brandId)]: { [uid]: [item] } }))
    },
    {
      brandId: TEST_BRAND_ID,
      uid: TEST_UID,
      externalId: TEST_PRODUCT_EXTERNAL_ID,
      handle: TEST_PRODUCT_HANDLE,
    },
  )

  await bootSdk(page, {
    firestoreDocs: { styles: { 'test-style': TEST_SEEDED_STYLE } },
    apiOverrides: {
      sizeRecommendation: (route) => route.fulfill({ json: TEST_SIZE_FIT_RECOMMENDATION }),
      styleCategories: (route) => route.fulfill({ json: [TSHIRT_CATEGORY] }),
      styleCategoryGroups: (route) => route.fulfill({ json: [TOPS_GROUP] }),
      vtoComposition: (route) => {
        vtoItems?.push((route.request().postDataJSON() as { items: { colorway_size_asset_id: number }[] }).items)
        return route.fulfill({ json: TEST_VTO_COMPOSITION })
      },
    },
  })

  await page.getByRole('button', { name: 'Fitting Room', exact: true }).click()
  // Selecting the rail card adds it to the outfit and opens its section.
  await page.getByRole('button', { name: /Test Product/i }).click()
}

// The section header, which doubles as the collapse/expand toggle.
function sectionHeader(page: Page) {
  return page.getByRole('button', { name: /^Top/ }).first()
}

// The accordion item wrapping that header. Everything is asserted through this
// rather than the page: the product name also appears on the rail card, and
// the test host page renders its own S/M size buttons, so unscoped locators
// match the wrong elements (or several at once).
function section(page: Page) {
  return sectionHeader(page).locator('xpath=..')
}

test('desktop: a collapsed section shows the product name and a size selector', async ({ page }) => {
  await bootDesktopFittingRoom(page)

  // Open by default after selection — the size selector here belongs to the
  // expanded body, so collapse first to assert against the collapsed strip.
  await expect(page.getByText('Recommended Size: M')).toBeVisible({ timeout: 10000 })
  await sectionHeader(page).click()
  await expect(page.getByText('Recommended Size: M')).toBeHidden()

  // Collapsed: the product name and its sizes remain reachable.
  await expect(section(page).getByText('Test Product', { exact: true })).toBeVisible()
  await expect(section(page).getByRole('button', { name: 'M', exact: true })).toBeVisible()
  await expect(section(page).getByRole('button', { name: 'S', exact: true })).toBeVisible()
})

test('desktop: changing size from a collapsed section does not toggle the section', async ({ page }) => {
  const vtoItems: { colorway_size_asset_id: number }[][] = []
  await bootDesktopFittingRoom(page, vtoItems)
  await expect(page.getByText('Recommended Size: M')).toBeVisible({ timeout: 10000 })
  await sectionHeader(page).click()
  await expect(page.getByText('Recommended Size: M')).toBeHidden()

  const requestsBefore = vtoItems.length
  await section(page).getByRole('button', { name: 'S', exact: true }).click()

  // The size change must reach the VTO request...
  await expect.poll(() => vtoItems.length, { timeout: 8000 }).toBeGreaterThan(requestsBefore)
  expect(vtoItems[vtoItems.length - 1].map((i) => i.colorway_size_asset_id)).toEqual([5002])

  // ...without the section springing open, which is what would happen if the
  // pills were rendered inside the header's toggle button.
  await expect(page.getByText('Recommended Size: M')).toBeHidden()
  await expect(section(page).getByText('Test Product', { exact: true })).toBeVisible()
})
