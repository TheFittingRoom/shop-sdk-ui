import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { bootSdk } from './helpers/boot'
import {
  TEST_BRAND_ID,
  TEST_CONTAINER_CURRENT_PRODUCT,
  TEST_CONTAINER_EXTERNAL_ID,
  TEST_CONTAINER_HANDLE,
  TEST_CONTAINER_PARENT_SIZE_ID,
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

// The try-on takes at most 3 garments, temporarily (WEB-36; normally 4), and
// a Set counts one per piece (MAX_OUTFIT_ITEMS in fitting-room-outfit.ts). A
// card that would take the outfit over the cap is disabled; one that replaces
// enough of the outfit to stay within it is not.

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
// Test Product, in a group of its own so it clashes with nothing.
const TSHIRT = { ...BASE_CATEGORY, name: 'tshirt', label: 'T-Shirts', label_singular: 'T-Shirt', group: 'extras' }
// Second Product: clashes with the Set's trousers.
const PANTS = { ...BASE_CATEGORY, name: 'pants', label: 'Pants', label_singular: 'Pant', group: 'bottoms' }
const SET = {
  ...BASE_CATEGORY,
  name: 'suits_and_sets',
  label: 'Suits & Sets',
  label_singular: 'Set',
  group: 'sets',
  is_container: true,
}
// The Set's pieces: a shirt and trousers, then a blazer and a vest.
const INNER_TOPS = { ...BASE_CATEGORY, name: 'inner_tops', label: 'Tops', label_singular: 'Top', group: 'tops' }
const BOTTOMS = { ...BASE_CATEGORY, name: 'bottoms', label: 'Bottoms', label_singular: 'Bottom', group: 'bottoms' }
const BLAZERS = { ...BASE_CATEGORY, name: 'blazers', label: 'Blazers', label_singular: 'Blazer', group: 'outerwear' }
const VESTS = { ...BASE_CATEGORY, name: 'vests', label: 'Vests', label_singular: 'Vest', group: 'vests' }
const CATEGORIES = [TSHIRT, PANTS, SET, INNER_TOPS, BOTTOMS, BLAZERS, VESTS]
const GROUPS = ['tops', 'bottoms', 'sets', 'outerwear', 'vests', 'extras'].map((name, i) => ({
  name,
  label: name,
  same_group_default: 'exclusive',
  display_order: i + 1,
}))

// The seeded 2-piece Set (shirt + trousers), with a blazer and then a vest
// added to make 3 or 4 pieces.
function setWithPieces(pieces: number) {
  const extras = [
    { name: 'Blazer', category: 'blazers', label: 'Blazers' },
    { name: 'Vest', category: 'vests', label: 'Vests' },
  ].slice(0, pieces - 2)
  const children = [
    ...TEST_CONTAINER_SEEDED_STYLE.children,
    ...extras.map((extra, i) => ({
      id: 503 + i,
      name: extra.name,
      component_index: 2 + i,
      style_category_name: extra.category,
      style_category_label: extra.label,
      size_system_id: 1,
      vertical_size_system_id: 0,
      sizes: [{ id: 7003 + i, label: 'M', size_value_id: 5 }],
      colorway_size_assets: [
        {
          id: 8003 + i,
          brand_id: TEST_BRAND_ID,
          size_id: 7003 + i,
          style_id: 503 + i,
          colorway_id: 5300 + i,
          colorway_name: 'default',
          sku: '',
          folder_storage_path: '',
          asset_container_name: '',
        },
      ],
    })),
  ]
  return {
    ...TEST_CONTAINER_SEEDED_STYLE,
    children,
    set_size_mappings: children.map((c) => ({
      parent_size_id: TEST_CONTAINER_PARENT_SIZE_ID,
      child_size_id: c.sizes[0].id,
    })),
  }
}

// Opens the desktop fitting room holding Test Product (T-shirt), Second
// Product (pants) and a Set of `pieces` pieces, none selected. Returns the
// items of every try-on request.
async function bootFittingRoom(page: Page, pieces: number) {
  const vtoItems: unknown[][] = []
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
    {
      brandId: TEST_BRAND_ID,
      uid: TEST_UID,
      products: [
        { externalId: TEST_PRODUCT_EXTERNAL_ID, handle: TEST_PRODUCT_HANDLE },
        { externalId: TEST_PRODUCT_B_EXTERNAL_ID, handle: TEST_PRODUCT_B_HANDLE },
        { externalId: TEST_CONTAINER_EXTERNAL_ID, handle: TEST_CONTAINER_HANDLE },
      ],
    },
  )
  await bootSdk(page, {
    productCatalog: [TEST_CURRENT_PRODUCT_B, TEST_CONTAINER_CURRENT_PRODUCT],
    firestoreDocs: {
      styles: {
        'test-style': TEST_SEEDED_STYLE,
        'test-style-b': TEST_SEEDED_STYLE_B,
        'container-style-1': setWithPieces(pieces),
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
      styleCategories: (route) => route.fulfill({ json: CATEGORIES }),
      styleCategoryGroups: (route) => route.fulfill({ json: GROUPS }),
      vtoComposition: (route) => {
        vtoItems.push((route.request().postDataJSON() as { items: unknown[] }).items)
        return route.fulfill({ status: 404, json: { error: 'not rendered in this test' } })
      },
    },
  })
  await page.getByRole('button', { name: 'Fitting Room', exact: true }).click()
  // Every card is resolved (the Set's pieces counted) before anything is
  // clicked: an unresolved Set counts as no garments.
  await expect(card(page, /Test Suit Set/i)).toBeVisible()
  await expect(card(page, /Second Product/i)).toBeVisible()
  return vtoItems
}

const card = (page: Page, name: RegExp) => page.getByRole('dialog').getByRole('button', { name })
// A selected item's row in the detail pane, headed by its category.
const row = (page: Page, category: string) => page.getByRole('button', { name: new RegExp(`^${category}(\\s|$)`) })

test('a 3-piece Set is within the cap', async ({ page }) => {
  const vtoItems = await bootFittingRoom(page, 3)
  await card(page, /Test Suit Set/i).click()
  await expect(row(page, 'Set')).toBeVisible()
  await expect.poll(() => vtoItems.at(-1)?.length).toBe(3)
})

test('a 4-piece Set is over the cap and cannot be selected', async ({ page }) => {
  const vtoItems = await bootFittingRoom(page, 4)
  await expect(card(page, /Test Suit Set/i)).toBeDisabled()
  await card(page, /Test Suit Set/i).click({ force: true })
  await expect(row(page, 'Set')).toHaveCount(0)
  await page.waitForTimeout(300)
  expect(vtoItems).toEqual([])
})

test('below the cap, a garment that clashes with nothing is added', async ({ page }) => {
  const vtoItems = await bootFittingRoom(page, 2)
  await card(page, /Test Suit Set/i).click()
  await expect(row(page, 'Set')).toBeVisible()
  await card(page, /Test Product/i).click()
  // 2 + 1 = 3.
  await expect(row(page, 'T-Shirt')).toBeVisible()
  await expect(row(page, 'Set')).toBeVisible()
  await expect.poll(() => vtoItems.at(-1)?.length).toBe(3)
})

test('at the cap, a garment that clashes with nothing cannot be added', async ({ page }) => {
  await bootFittingRoom(page, 3)
  await card(page, /Test Suit Set/i).click()
  await expect(row(page, 'Set')).toBeVisible()
  // 3 + 1 = 4.
  await expect(card(page, /Test Product/i)).toBeDisabled()
  await card(page, /Test Product/i).click({ force: true })
  await expect(row(page, 'T-Shirt')).toHaveCount(0)
  await expect(row(page, 'Set')).toBeVisible()
})

test('at the cap, a garment that replaces the Set is added', async ({ page }) => {
  await bootFittingRoom(page, 3)
  await card(page, /Test Suit Set/i).click()
  await expect(row(page, 'Set')).toBeVisible()
  // The pants clash with the Set's trousers, so the Set leaves: 0 + 1.
  await card(page, /Second Product/i).click()
  await expect(row(page, 'Pant')).toBeVisible()
  await expect(row(page, 'Set')).toHaveCount(0)
})
