import type { Page } from '@playwright/test'
import { devices, expect, test } from '@playwright/test'
import { bootSdk } from './helpers/boot'
import {
  TEST_BRAND_ID,
  TEST_CONTAINER_CURRENT_PRODUCT,
  TEST_CONTAINER_EXTERNAL_ID,
  TEST_CONTAINER_HANDLE,
  TEST_CONTAINER_SEEDED_STYLE,
  TEST_CONTAINER_SIZE_FIT_RECOMMENDATION,
  TEST_CONTAINER_STYLE_ID,
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
} from './fixtures/seed'

// A clash between two products never disables a card: selecting one evicts
// whatever it can't be worn with (getOutfitConflicts). Only the garment cap
// disables. The outfit is read off the desktop detail pane, which has one row
// per selected item, headed by its category.

const BASE_CATEGORY = {
  layer_order: 60,
  tuckable: false,
  layer_order_untucked: 60,
  sleeve_selection: 'not_applicable',
  measurement_locations: [],
  additional_locations_full_sleeves: [],
  includes: [] as string[],
  excludes: [] as string[],
  is_container: false,
}
// Test Product.
const TSHIRT = { ...BASE_CATEGORY, name: 'tshirt', label: 'T-Shirts', label_singular: 'T-Shirt', group: 'tops' }
// Second Product.
const PANTS = { ...BASE_CATEGORY, name: 'pants', label: 'Pants', label_singular: 'Pant', group: 'bottoms' }
// The Set and its two pieces.
const SET = {
  ...BASE_CATEGORY,
  name: 'suits_and_sets',
  label: 'Suits & Sets',
  label_singular: 'Set',
  group: 'sets',
  is_container: true,
}
const INNER_TOPS = { ...BASE_CATEGORY, name: 'inner_tops', label: 'Tops', label_singular: 'Top', group: 'tops' }
const BOTTOMS = { ...BASE_CATEGORY, name: 'bottoms', label: 'Bottoms', label_singular: 'Bottom', group: 'bottoms' }

const GROUPS = [
  { name: 'tops', label: 'Tops', same_group_default: 'exclusive', display_order: 1 },
  { name: 'bottoms', label: 'Bottoms', same_group_default: 'exclusive', display_order: 2 },
  { name: 'sets', label: 'Sets', same_group_default: 'exclusive', display_order: 3 },
]

const PRODUCTS = [
  { externalId: TEST_PRODUCT_EXTERNAL_ID, handle: TEST_PRODUCT_HANDLE },
  { externalId: TEST_PRODUCT_B_EXTERNAL_ID, handle: TEST_PRODUCT_B_HANDLE },
  { externalId: TEST_CONTAINER_EXTERNAL_ID, handle: TEST_CONTAINER_HANDLE },
]

// Opens the desktop fitting room holding Test Product (T-shirt), Second
// Product (pants) and Test Suit Set (inner top + bottoms), none selected.
// `secondProductCategory` re-categorises Second Product (pants by default).
async function bootFittingRoom(
  page: Page,
  categories: unknown[] = [TSHIRT, PANTS, SET, INNER_TOPS, BOTTOMS],
  secondProductCategory = 'pants',
) {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.addInitScript(
    ({ brandId, uid, products }) => {
      const items = products.map((p, i) => ({
        externalId: p.externalId,
        handle: p.handle,
        size: null,
        color: null,
        colorwaySizeAssetId: null,
        addedAt: i + 1,
      }))
      window.localStorage.setItem('tfr:fitting-room:v1', JSON.stringify({ [String(brandId)]: { [uid]: items } }))
    },
    { brandId: TEST_BRAND_ID, uid: TEST_UID, products: PRODUCTS },
  )
  await bootSdk(page, {
    productCatalog: [TEST_CURRENT_PRODUCT_B, TEST_CONTAINER_CURRENT_PRODUCT],
    firestoreDocs: {
      styles: {
        'test-style': TEST_SEEDED_STYLE,
        'test-style-b': { ...TEST_SEEDED_STYLE_B, style_category_name: secondProductCategory },
        'container-style-1': TEST_CONTAINER_SEEDED_STYLE,
      },
    },
    apiOverrides: {
      sizeRecommendation: (route) => {
        const url = route.request().url()
        const json = url.includes(`/styles/${TEST_STYLE_B_ID}/`)
          ? TEST_SIZE_FIT_RECOMMENDATION_B
          : url.includes(`/styles/${TEST_CONTAINER_STYLE_ID}/`)
            ? TEST_CONTAINER_SIZE_FIT_RECOMMENDATION
            : TEST_SIZE_FIT_RECOMMENDATION
        return route.fulfill({ json })
      },
      styleCategories: (route) => route.fulfill({ json: categories }),
      styleCategoryGroups: (route) => route.fulfill({ json: GROUPS }),
    },
  })
  await page.getByRole('button', { name: 'Fitting Room', exact: true }).click()
}

const card = (page: Page, name: RegExp) => page.getByRole('dialog').getByRole('button', { name })
// Anchored on a word boundary so "Set" doesn't match the rail's "Sets" header.
const row = (page: Page, category: string) => page.getByRole('button', { name: new RegExp(`^${category}(\\s|$)`) })

async function expectOutfit(page: Page, categories: { in: string[]; out: string[] }) {
  for (const c of categories.in) {
    await expect(row(page, c)).toBeVisible()
  }
  for (const c of categories.out) {
    await expect(row(page, c)).toHaveCount(0)
  }
}

test('selecting a set evicts the standalone top and bottom it clashes with', async ({ page }) => {
  await bootFittingRoom(page)
  await card(page, /Test Product/i).click()
  await card(page, /Second Product/i).click()
  await expectOutfit(page, { in: ['T-Shirt', 'Pant'], out: ['Set'] })

  await card(page, /Test Suit Set/i).click()
  await expectOutfit(page, { in: ['Set'], out: ['T-Shirt', 'Pant'] })
})

test('selecting a standalone top or bottom evicts a selected set', async ({ page }) => {
  await bootFittingRoom(page)
  await card(page, /Test Suit Set/i).click()
  await expectOutfit(page, { in: ['Set'], out: ['T-Shirt', 'Pant'] })

  await card(page, /Test Product/i).click()
  await expectOutfit(page, { in: ['T-Shirt'], out: ['Set', 'Pant'] })

  // And back: the set evicts the top that just evicted it.
  await card(page, /Test Suit Set/i).click()
  await expectOutfit(page, { in: ['Set'], out: ['T-Shirt', 'Pant'] })

  await card(page, /Second Product/i).click()
  await expectOutfit(page, { in: ['Pant'], out: ['Set', 'T-Shirt'] })
})

test('a cross-group Excludes rule swaps too', async ({ page }) => {
  // T-shirts and pants are in different groups, so they only clash through
  // an explicit Excludes entry.
  await bootFittingRoom(page, [{ ...TSHIRT, excludes: ['pants'] }, PANTS, SET, INNER_TOPS, BOTTOMS])
  await card(page, /Test Product/i).click()
  await expectOutfit(page, { in: ['T-Shirt'], out: ['Pant'] })

  await card(page, /Second Product/i).click()
  await expectOutfit(page, { in: ['Pant'], out: ['T-Shirt'] })
})

// --- The swap notice ---------------------------------------------------------

const notice = (page: Page) => page.getByRole('status').filter({ hasText: /from your outfit/ })

test('a clash swap shows a teal notice naming what left, and Undo restores it', async ({ page }) => {
  await bootFittingRoom(page)
  await card(page, /Test Product/i).click()
  await card(page, /Second Product/i).click()
  await expect(notice(page)).toHaveCount(0)

  await card(page, /Test Suit Set/i).click()
  await expect(notice(page)).toHaveText(/Removed Test Product, Second Product from your outfit/)
  // TFR teal (theme.color_tfr_800), not the error snackbar's near-black.
  await expect(notice(page)).toHaveCSS('background-color', 'rgb(38, 90, 100)')

  await notice(page).getByRole('button', { name: 'Undo' }).click()
  await expectOutfit(page, { in: ['T-Shirt', 'Pant'], out: ['Set'] })
  await expect(notice(page)).toHaveCount(0)
})

test('a same-category swap shows no notice', async ({ page }) => {
  // Second Product as a second T-shirt.
  await bootFittingRoom(page, [TSHIRT, PANTS, SET, INNER_TOPS, BOTTOMS], 'tshirt')
  await card(page, /Test Product/i).click()
  await card(page, /Second Product/i).click()
  // One T-shirt row: the second replaced the first.
  await expect(row(page, 'T-Shirt')).toHaveCount(1)
  await expect(notice(page)).toHaveCount(0)
})

test('the notice closes on its own, and as soon as the outfit changes again', async ({ page }) => {
  await bootFittingRoom(page)
  await card(page, /Test Product/i).click()
  await card(page, /Test Suit Set/i).click()
  await expect(notice(page)).toBeVisible()
  // SWAP_NOTICE_MS is 5s.
  await expect(notice(page)).toHaveCount(0, { timeout: 8000 })

  // Another change makes Undo stale, so the notice goes with it.
  await card(page, /Test Product/i).click()
  await expect(notice(page)).toBeVisible()
  await card(page, /Second Product/i).click()
  await expect(notice(page)).toHaveCount(0)
  await expectOutfit(page, { in: ['T-Shirt', 'Pant'], out: ['Set'] })
})

// The notice sits above the overlay's bottom controls, not over them.
// Checked vertically only: the test host has no viewport meta, so the phone
// profile lays out 980px wide and a horizontal check would miss overlaps a
// real phone-width layout has.
async function expectClearOf(page: Page, controls: RegExp[]) {
  const box = await notice(page).boundingBox()
  expect(box).not.toBeNull()
  for (const name of controls) {
    const other = await page.getByRole('dialog').getByRole('button', { name }).boundingBox()
    expect(other, String(name)).not.toBeNull()
    if (box && other) {
      expect(box.y + box.height, `notice overlaps ${String(name)}`).toBeLessThanOrEqual(other.y)
    }
  }
}

test('desktop: the notice clears Add all to cart', async ({ page }) => {
  await bootFittingRoom(page)
  await card(page, /Test Product/i).click()
  await card(page, /Test Suit Set/i).click()
  await expectClearOf(page, [/^Add all to cart$/i])
})

test.describe('mobile', () => {
  const { defaultBrowserType: _b, ...pixel5 } = devices['Pixel 5']
  test.use(pixel5)

  test('the notice clears Try It On and Clear All', async ({ page }) => {
    await bootFittingRoom(page)
    // bootFittingRoom sizes the viewport for desktop; the layout is picked
    // from the device profile, so restoring a phone width is enough.
    await page.setViewportSize(pixel5.viewport)
    await card(page, /Test Product/i).click()
    await card(page, /Test Suit Set/i).click()
    await expectClearOf(page, [/^Try It On$/i, /^Clear All/i])
  })
})
