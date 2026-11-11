import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { bootSdk } from './helpers/boot'
import {
  TEST_BRAND_ID,
  TEST_CONTAINER_CHILD_PANTS_CSA_ID,
  TEST_CONTAINER_CHILD_SHIRT_CSA_ID,
  TEST_CONTAINER_CURRENT_PRODUCT,
  TEST_CONTAINER_EXTERNAL_ID,
  TEST_CONTAINER_HANDLE,
  TEST_CONTAINER_SEEDED_STYLE,
  TEST_CONTAINER_SIZE_FIT_RECOMMENDATION,
  TEST_CURRENT_PRODUCT,
  TEST_PRODUCT_EXTERNAL_ID,
  TEST_PRODUCT_HANDLE,
  TEST_SEEDED_STYLE,
  TEST_SIZE_FIT_RECOMMENDATION,
  TEST_UID,
  TEST_VTO_COMPOSITION,
} from './fixtures/seed'

// WEB-105: a fitting-room entry stores only what the shopper chose — a size
// they clicked, a colour — and the size, colour and colorway-size asset that
// are tried on and bought are derived from that plus the CURRENT size
// recommendation. Before, the first selection stored whatever was recommended
// at the time and kept it as if chosen, so a recommendation that later moved
// (a re-scan, a size-rec change) left the shopper on a size they never picked
// (WEB-98).
//
// The product here comes in Blue and Red, in M (recommended) and S:
//   M Blue 5001, S Blue 5002, M Red 5011, S Red 5012.

const M_BLUE = 5001
const S_BLUE = 5002
const M_RED = 5011
const S_RED = 5012

const TWO_COLOUR_PRODUCT = {
  ...TEST_CURRENT_PRODUCT,
  variants: [
    ...TEST_CURRENT_PRODUCT.variants,
    {
      ...TEST_CURRENT_PRODUCT.variants[0],
      sku: 'SKU-M-RED',
      color: 'Red',
      fullName: 'Test M Red',
      skuName: 'SKU-M-RED',
    },
    {
      ...TEST_CURRENT_PRODUCT.variants[1],
      sku: 'SKU-S-RED',
      color: 'Red',
      fullName: 'Test S Red',
      skuName: 'SKU-S-RED',
    },
  ],
}

const SIZE_M = {
  id: 101,
  label: 'M',
  size_value: { value: 'M' },
  colorway_size_assets: [
    { id: M_BLUE, sku: 'SKU-M-BLUE' },
    { id: M_RED, sku: 'SKU-M-RED' },
  ],
}
const SIZE_S = {
  id: 102,
  label: 'S',
  size_value: { value: 'S' },
  colorway_size_assets: [
    { id: S_BLUE, sku: 'SKU-S-BLUE' },
    { id: S_RED, sku: 'SKU-S-RED' },
  ],
}

function recommending(size: typeof SIZE_M) {
  return { ...TEST_SIZE_FIT_RECOMMENDATION, recommended_size: size, available_sizes: [SIZE_M, SIZE_S] }
}

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

type StoredEntry = Record<string, unknown>

// Seed one fitting-room entry before the SDK boots — only when storage is
// empty, so a reload keeps whatever the SDK wrote.
async function seed(page: Page, entry: StoredEntry) {
  await page.addInitScript(
    ({ brandId, uid, item }) => {
      if (window.localStorage.getItem('tfr:fitting-room:v1')) {
        return
      }
      window.localStorage.setItem('tfr:fitting-room:v1', JSON.stringify({ [String(brandId)]: { [uid]: [item] } }))
    },
    {
      brandId: TEST_BRAND_ID,
      uid: TEST_UID,
      item: { externalId: TEST_PRODUCT_EXTERNAL_ID, handle: TEST_PRODUCT_HANDLE, addedAt: 1, ...entry },
    },
  )
}

async function storedEntry(page: Page): Promise<StoredEntry | null> {
  return page.evaluate(
    ({ brandId, uid }) => {
      const raw = window.localStorage.getItem('tfr:fitting-room:v1')
      const parsed = raw ? (JSON.parse(raw) as Record<string, Record<string, StoredEntry[]>>) : null
      return parsed?.[String(brandId)]?.[uid]?.[0] ?? null
    },
    { brandId: TEST_BRAND_ID, uid: TEST_UID },
  )
}

// Boot on a desktop layout with a size recommendation `rec()` reads at
// request time, so a test can change the recommendation and reload. Returns
// the CSA ids of every VTO request.
async function boot(page: Page, rec: () => unknown) {
  const vtoRequests: number[][] = []
  await page.setViewportSize({ width: 1440, height: 900 })
  await bootSdk(page, {
    currentProduct: TWO_COLOUR_PRODUCT,
    firestoreDocs: { styles: { 'test-style': TEST_SEEDED_STYLE } },
    apiOverrides: {
      sizeRecommendation: (route) => route.fulfill({ json: rec() }),
      styleCategories: (route) => route.fulfill({ json: [TSHIRT_CATEGORY] }),
      styleCategoryGroups: (route) => route.fulfill({ json: [TOPS_GROUP] }),
      vtoComposition: (route) => {
        const body = route.request().postDataJSON() as { items: { colorway_size_asset_id: number }[] }
        vtoRequests.push(body.items.map((i) => i.colorway_size_asset_id))
        return route.fulfill({ json: TEST_VTO_COMPOSITION })
      },
    },
  })
  return vtoRequests
}

async function openAndSelect(page: Page) {
  await page.getByRole('button', { name: 'Fitting Room', exact: true }).click()
  await page.getByRole('button', { name: /Test Product/i }).click()
}

async function lastRequest(vtoRequests: number[][]): Promise<number[]> {
  await expect.poll(() => vtoRequests.length, { timeout: 8000 }).toBeGreaterThan(0)
  return vtoRequests[vtoRequests.length - 1]
}

// The open detail section (the header is the collapse toggle; its parent
// wraps the section). Scoped because the host page renders its own S/M
// buttons.
function section(page: Page) {
  return page.getByRole('button', { name: /^Top/ }).first().locator('xpath=..')
}

test('no saved size: the item is tried on in the recommended size, and selecting it saves no size', async ({
  page,
}) => {
  await seed(page, { size: null, color: 'Blue' })
  const vtoRequests = await boot(page, () => recommending(SIZE_M))
  await openAndSelect(page)

  expect(await lastRequest(vtoRequests)).toEqual([M_BLUE])
  expect((await storedEntry(page))?.size).toBeNull()
})

test('an unchosen size follows the recommendation when it changes (WEB-98)', async ({ page }) => {
  await seed(page, { size: null, color: 'Blue' })
  let rec = recommending(SIZE_M)
  const vtoRequests = await boot(page, () => rec)
  await openAndSelect(page)
  expect(await lastRequest(vtoRequests)).toEqual([M_BLUE])

  // The recommendation moves to S (a re-scan, say). M is still offered, so
  // a stored M would survive this; an unchosen size must not.
  rec = recommending(SIZE_S)
  vtoRequests.length = 0
  await page.reload()
  await openAndSelect(page)
  expect(await lastRequest(vtoRequests)).toEqual([S_BLUE])
})

test('a chosen size survives a recommendation that differs from it', async ({ page }) => {
  await seed(page, { size: 'S', color: 'Blue' })
  const vtoRequests = await boot(page, () => recommending(SIZE_M))
  await openAndSelect(page)

  expect(await lastRequest(vtoRequests)).toEqual([S_BLUE])
})

test('a chosen size that is no longer offered falls back to the recommendation', async ({ page }) => {
  await seed(page, { size: 'XL', color: 'Blue' })
  const vtoRequests = await boot(page, () => recommending(SIZE_M))
  await openAndSelect(page)

  expect(await lastRequest(vtoRequests)).toEqual([M_BLUE])
})

test('a chosen colour is kept with the recommended size', async ({ page }) => {
  await seed(page, { size: null, color: 'Red' })
  const vtoRequests = await boot(page, () => recommending(SIZE_M))
  await openAndSelect(page)

  expect(await lastRequest(vtoRequests)).toEqual([M_RED])
})

test('clicking a size saves that size and nothing else', async ({ page }) => {
  await seed(page, { size: null, color: 'Red' })
  const vtoRequests = await boot(page, () => recommending(SIZE_M))
  await openAndSelect(page)
  expect(await lastRequest(vtoRequests)).toEqual([M_RED])

  await section(page).getByRole('button', { name: 'S', exact: true }).click()

  await expect.poll(async () => (await storedEntry(page))?.size).toBe('S')
  const entry = await storedEntry(page)
  expect(entry?.color).toBe('Red')
  expect(entry).not.toHaveProperty('colorwaySizeAssetId')
  expect(await lastRequest(vtoRequests)).toEqual([S_RED])
})

test('clicking a colour saves that colour and leaves the size unchosen', async ({ page }) => {
  await seed(page, { size: null, color: 'Blue' })
  const vtoRequests = await boot(page, () => recommending(SIZE_M))
  await openAndSelect(page)
  expect(await lastRequest(vtoRequests)).toEqual([M_BLUE])

  await page.getByRole('button', { name: 'Pick colour Red', exact: true }).first().click()

  await expect.poll(async () => (await storedEntry(page))?.color).toBe('Red')
  expect((await storedEntry(page))?.size).toBeNull()
  expect(await lastRequest(vtoRequests)).toEqual([M_RED])
})

test('add to cart with no saved size adds the recommended size', async ({ page }) => {
  await seed(page, { size: null, color: null })
  await boot(page, () => recommending(SIZE_M))
  await openAndSelect(page)

  await page.getByRole('dialog').getByRole('button', { name: 'Add to cart', exact: true }).click()

  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as unknown as { __TFR_TEST_ADDS__?: { opts: unknown }[] }).__TFR_TEST_ADDS__?.map((a) => a.opts) ??
          [],
      ),
    )
    .toEqual([{ size: 'M', color: 'Blue' }])
})

test('an entry saved before WEB-105 loads; its stored CSA is ignored and dropped', async ({ page }) => {
  // Older entries carry a colorwaySizeAssetId, here one that no longer exists
  // (the style was re-saved and its rows replaced). It must never reach VTO.
  await seed(page, { size: 'M', color: 'Blue', colorwaySizeAssetId: 999999 })
  const vtoRequests = await boot(page, () => recommending(SIZE_M))
  await openAndSelect(page)

  const ids = await lastRequest(vtoRequests)
  expect(ids).toEqual([M_BLUE])
  // The saved size is kept (Ky's call: existing selections aren't reset);
  // the stale id is gone from storage after the SDK's first write.
  const entry = await storedEntry(page)
  expect(entry?.size).toBe('M')
  expect(entry).not.toHaveProperty('colorwaySizeAssetId')
})

test('quick view: a size click is saved for a product in the fitting room; a colour click saves no size', async ({
  page,
}) => {
  await seed(page, { size: null, color: 'Blue' })
  await boot(page, () => recommending(SIZE_M))
  await page.getByRole('button', { name: /quick view/i }).click()
  const dialog = page.getByRole('dialog')

  await dialog.locator('select').first().selectOption('Red')
  await expect.poll(async () => (await storedEntry(page))?.color).toBe('Red')
  expect((await storedEntry(page))?.size).toBeNull()

  await dialog.getByRole('button', { name: 'S', exact: true }).first().click()
  await expect.poll(async () => (await storedEntry(page))?.size).toBe('S')
})

test('a Set: a chosen size whose pieces are no longer mapped falls back to the recommendation', async ({ page }) => {
  // The Set comes in M/32 (recommended, mapped to its shirt and trousers) and
  // L/34, which is offered and sold but has no piece mapping (the merchant
  // removed it). A shopper who chose L/34 must still get a try-on, in M/32,
  // rather than the Set silently dropping out of the outfit.
  const unmapped = {
    id: 6101,
    label: 'L/34',
    size_value: { value: 'L/34' },
    colorway_size_assets: [{ id: 6002, sku: 'SET-L34-DEFAULT', colorway_id: 4100, colorway_name: 'default' }],
  }
  const rec = {
    ...TEST_CONTAINER_SIZE_FIT_RECOMMENDATION,
    available_sizes: [...TEST_CONTAINER_SIZE_FIT_RECOMMENDATION.available_sizes, unmapped],
    fits: [...TEST_CONTAINER_SIZE_FIT_RECOMMENDATION.fits, { size_id: 6101, measurement_location_fits: [] }],
  }
  const product = {
    ...TEST_CONTAINER_CURRENT_PRODUCT,
    variants: [
      ...TEST_CONTAINER_CURRENT_PRODUCT.variants,
      {
        ...TEST_CONTAINER_CURRENT_PRODUCT.variants[0],
        sku: 'SET-L34-DEFAULT',
        size: 'L/34',
        skuName: 'SET-L34-DEFAULT',
      },
    ],
  }
  const base = { ...TSHIRT_CATEGORY, layer_order: 60, layer_order_untucked: 60, includes: [], excludes: [] }
  const categories = [
    {
      ...base,
      name: 'suits_and_sets',
      label: 'Suits & Sets',
      label_singular: 'Set',
      group: 'sets',
      is_container: true,
    },
    { ...base, name: 'inner_tops', label: 'Tops', label_singular: 'Top', group: 'tops' },
    { ...base, name: 'bottoms', label: 'Bottoms', label_singular: 'Bottom', group: 'bottoms' },
  ]
  const groups = ['tops', 'bottoms', 'sets'].map((name, i) => ({
    name,
    label: name,
    same_group_default: 'exclusive',
    display_order: i + 1,
  }))

  await page.addInitScript(
    ({ brandId, uid, item }) => {
      window.localStorage.setItem('tfr:fitting-room:v1', JSON.stringify({ [String(brandId)]: { [uid]: [item] } }))
    },
    {
      brandId: TEST_BRAND_ID,
      uid: TEST_UID,
      item: {
        externalId: TEST_CONTAINER_EXTERNAL_ID,
        handle: TEST_CONTAINER_HANDLE,
        size: 'L/34',
        color: null,
        addedAt: 1,
      },
    },
  )
  const vtoRequests: number[][] = []
  await page.setViewportSize({ width: 1440, height: 900 })
  await bootSdk(page, {
    productCatalog: [product],
    firestoreDocs: { styles: { 'container-style': TEST_CONTAINER_SEEDED_STYLE } },
    apiOverrides: {
      sizeRecommendation: (route) => route.fulfill({ json: rec }),
      styleCategories: (route) => route.fulfill({ json: categories }),
      styleCategoryGroups: (route) => route.fulfill({ json: groups }),
      vtoComposition: (route) => {
        const body = route.request().postDataJSON() as { items: { colorway_size_asset_id: number }[] }
        vtoRequests.push(body.items.map((i) => i.colorway_size_asset_id))
        return route.fulfill({ json: TEST_VTO_COMPOSITION })
      },
    },
  })
  await page.getByRole('button', { name: 'Fitting Room', exact: true }).click()
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /Test Suit Set/i })
    .click()

  expect((await lastRequest(vtoRequests)).sort()).toEqual(
    [TEST_CONTAINER_CHILD_SHIRT_CSA_ID, TEST_CONTAINER_CHILD_PANTS_CSA_ID].sort(),
  )
})
