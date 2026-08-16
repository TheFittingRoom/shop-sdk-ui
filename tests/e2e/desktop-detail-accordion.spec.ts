import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { bootSdk } from './helpers/boot'
import {
  TEST_BRAND_ID,
  TEST_CURRENT_PRODUCT_B,
  TEST_PRODUCT_B_EXTERNAL_ID,
  TEST_PRODUCT_B_HANDLE,
  TEST_PRODUCT_EXTERNAL_ID,
  TEST_PRODUCT_HANDLE,
  TEST_SEEDED_STYLE,
  TEST_SEEDED_STYLE_B,
  TEST_SIZE_FIT_RECOMMENDATION,
  TEST_SIZE_FIT_RECOMMENDATION_B,
  TEST_STYLE_B_ID,
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

// A second product in its own category, so both sit in the outfit at once and
// the accordion has two sections.
const PANTS_CATEGORY = {
  ...TSHIRT_CATEGORY,
  name: 'pants',
  label: 'Pants',
  label_singular: 'Pant',
  group: 'bottoms',
  layer_order: 20,
  layer_order_untucked: 20,
}
const BOTTOMS_GROUP = { name: 'bottoms', label: 'Bottoms', same_group_default: 'exclude', display_order: 2 }

async function bootTwoSectionFittingRoom(page: Page) {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.addInitScript(
    ({ brandId, uid, a, b }) => {
      const items = [
        { externalId: a.externalId, handle: a.handle, size: 'M', color: 'Blue', colorwaySizeAssetId: null, addedAt: 1 },
        {
          externalId: b.externalId,
          handle: b.handle,
          size: 'M',
          color: 'Black',
          colorwaySizeAssetId: null,
          addedAt: 2,
        },
      ]
      window.localStorage.setItem('tfr:fitting-room:v1', JSON.stringify({ [String(brandId)]: { [uid]: items } }))
    },
    {
      brandId: TEST_BRAND_ID,
      uid: TEST_UID,
      a: { externalId: TEST_PRODUCT_EXTERNAL_ID, handle: TEST_PRODUCT_HANDLE },
      b: { externalId: TEST_PRODUCT_B_EXTERNAL_ID, handle: TEST_PRODUCT_B_HANDLE },
    },
  )

  await bootSdk(page, {
    productCatalog: [TEST_CURRENT_PRODUCT_B],
    firestoreDocs: { styles: { 'test-style': TEST_SEEDED_STYLE, 'test-style-b': TEST_SEEDED_STYLE_B } },
    apiOverrides: {
      sizeRecommendation: (route) =>
        route.fulfill({
          json: route.request().url().includes(`/styles/${TEST_STYLE_B_ID}/`)
            ? TEST_SIZE_FIT_RECOMMENDATION_B
            : TEST_SIZE_FIT_RECOMMENDATION,
        }),
      styleCategories: (route) => route.fulfill({ json: [TSHIRT_CATEGORY, PANTS_CATEGORY] }),
      styleCategoryGroups: (route) => route.fulfill({ json: [TOPS_GROUP, BOTTOMS_GROUP] }),
      vtoComposition: (route) => route.fulfill({ json: TEST_VTO_COMPOSITION }),
    },
  })

  await page.getByRole('button', { name: 'Fitting Room', exact: true }).click()
}

test('desktop: removing the open item opens another section rather than collapsing everything', async ({ page }) => {
  // At most one section is open, and normally one *is* — so when the open item
  // stops being selected while others remain, the open state moves rather than
  // leaving the shopper staring at a column of collapsed headers.
  //
  // This case was uncoverable until MockFirestoreManager honoured query
  // constraints: both test products previously resolved to the first seeded
  // style, hence the same category, so selecting the second evicted the first
  // and there was never more than one section.
  await bootTwoSectionFittingRoom(page)

  await page.getByRole('button', { name: /Test Product/i }).click()
  await page.getByRole('button', { name: /Second Product/i }).click()

  // Two sections; the most recent add is the open one.
  const topHeader = page.getByRole('button', { name: /^Top/ }).first()
  const pantHeader = page.getByRole('button', { name: /^Pant/ }).first()
  await expect(topHeader).toBeVisible({ timeout: 10000 })
  await expect(pantHeader).toBeVisible()
  await expect(pantHeader.locator('xpath=..').getByText('Recommended Size: M')).toBeVisible()

  // Deselect the open item from its rail card.
  await page.getByRole('button', { name: /Second Product/i }).click()

  // Its section is gone, and the survivor took over the open state instead of
  // everything collapsing.
  await expect(pantHeader).toBeHidden()
  await expect(topHeader.locator('xpath=..').getByText('Recommended Size: M')).toBeVisible({ timeout: 5000 })
})

test('desktop: collapsing the open section leaves every section collapsed', async ({ page }) => {
  // The other half of the rule: zero-open is legitimate when the shopper asks
  // for it. Nothing may spring back open, or the collapse control is unusable.
  await bootTwoSectionFittingRoom(page)

  await page.getByRole('button', { name: /Test Product/i }).click()
  await page.getByRole('button', { name: /Second Product/i }).click()

  const pantHeader = page.getByRole('button', { name: /^Pant/ }).first()
  await expect(pantHeader.locator('xpath=..').getByText('Recommended Size: M')).toBeVisible({ timeout: 10000 })

  await pantHeader.click()

  await expect(page.getByText('Recommended Size: M')).toBeHidden()
  await page.waitForTimeout(500)
  await expect(page.getByText('Recommended Size: M')).toBeHidden()
})
