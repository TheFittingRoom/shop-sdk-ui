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
} from './fixtures/seed'

// The tuck control is shown, hidden and worded by the `tuck` object on the VTO
// response — the backend owns the rules (oversized top, dress in the outfit,
// fitted dress under a loose top). The SDK must not decide any of it from the
// style categories.
//
// Every test here uses the same outfit: a tuckable top with pants layered
// above its tucked-in position. By the categories alone that outfit "can be
// tucked", so a control that ignores the response shows "Untuck" in all of
// them — which is exactly what the unavailable and Top Over cases catch.

const TOP_CATEGORY = {
  name: 'tshirt',
  label: 'T-Shirts',
  label_singular: 'T-Shirt',
  group: 'tops',
  layer_order: 60,
  tuckable: true,
  layer_order_untucked: 130,
  sleeve_selection: 'not_applicable',
  measurement_locations: [],
  additional_locations_full_sleeves: [],
  includes: [],
  excludes: [],
  is_container: false,
}
const PANTS_CATEGORY = {
  ...TOP_CATEGORY,
  name: 'pants',
  label: 'Pants',
  label_singular: 'Pant',
  group: 'bottoms',
  layer_order: 100,
  tuckable: false,
  layer_order_untucked: 100,
}
const TOPS_GROUP = { name: 'tops', label: 'Tops', same_group_default: 'exclude', display_order: 1 }
const BOTTOMS_GROUP = { name: 'bottoms', label: 'Bottoms', same_group_default: 'exclude', display_order: 2 }

type WireItem = { colorway_size_asset_id: number; untucked?: boolean }
type Tuck = { available: boolean; untucked: boolean; label: string }

// Boots a fitting room holding the top and the pants, answering every VTO
// request with frames unique to that composition and the tuck ruling `tuckFor`
// returns for it. Returns the captured request bodies.
async function bootTopAndPants(page: Page, tuckFor: (items: WireItem[]) => Tuck | undefined): Promise<WireItem[][]> {
  const requests: WireItem[][] = []
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
      styleCategories: (route) => route.fulfill({ json: [TOP_CATEGORY, PANTS_CATEGORY] }),
      styleCategoryGroups: (route) => route.fulfill({ json: [TOPS_GROUP, BOTTOMS_GROUP] }),
      vtoComposition: (route) => {
        const { items } = route.request().postDataJSON() as { items: WireItem[] }
        requests.push(items)
        const token = items
          .map((i) => `${i.colorway_size_asset_id}${i.untucked ? 'u' : 't'}`)
          .sort()
          .join('-')
        return route.fulfill({
          json: {
            token: `tok-${token}`,
            frames: [`user-test/avatar-1/vto-${token}/frames/image_0.png`],
            tuck: tuckFor(items),
          },
        })
      },
    },
  })

  await page.getByRole('button', { name: 'Fitting Room', exact: true }).click()
  await page.getByRole('button', { name: /Test Product/i }).click()
  await page.getByRole('button', { name: /Second Product/i }).click()
  // Both garments rendered together: the two-garment response has arrived.
  await expect(page.locator('img[src*="/vto-"]')).toHaveAttribute('src', /vto-\d+t-\d+t\//, { timeout: 10000 })
  return requests
}

const isOutfit = (items: WireItem[]) => items.length === 2

// The pill's text can be visually collapsed, so match on DOM text.
const tuckButton = (page: Page, text: string) => page.locator('button', { hasText: new RegExp(`^${text}$`) })

test('tuck control: available outfit shows Untuck, and toggling requests the untucked outfit', async ({ page }) => {
  const requests = await bootTopAndPants(page, (items) => ({
    available: isOutfit(items),
    untucked: items.some((i) => i.untucked),
    label: 'tuck',
  }))

  await expect(tuckButton(page, 'Untuck')).toHaveCount(1)
  await tuckButton(page, 'Untuck').click()

  // Only the tuckable top carries the flag; the pants never do.
  await expect(page.locator('img[src*="/vto-"]')).toHaveAttribute('src', /vto-\d+u-\d+t\//, { timeout: 10000 })
  const untuckedRequest = requests.find((items) => items.some((i) => i.untucked))
  expect(untuckedRequest?.filter((i) => i.untucked)).toHaveLength(1)

  await expect(tuckButton(page, 'Tuck In')).toHaveCount(1)
  await expect(tuckButton(page, 'Untuck')).toHaveCount(0)
})

test('tuck control: the response label switches the wording to Top Over / Top Under', async ({ page }) => {
  await bootTopAndPants(page, (items) => ({
    available: isOutfit(items),
    untucked: items.some((i) => i.untucked),
    label: 'top_over_under',
  }))

  await expect(tuckButton(page, 'Top Over')).toHaveCount(1)
  await expect(tuckButton(page, 'Untuck')).toHaveCount(0)

  await tuckButton(page, 'Top Over').click()
  await expect(tuckButton(page, 'Top Under')).toHaveCount(1)
  await expect(tuckButton(page, 'Top Over')).toHaveCount(0)
})

test('tuck control: hidden when the response rules it unavailable', async ({ page }) => {
  // The backend forced the top untucked (e.g. it is oversized): no control,
  // even though the categories alone say this outfit can be tucked.
  await bootTopAndPants(page, () => ({ available: false, untucked: true, label: 'tuck' }))

  await expect(tuckButton(page, 'Untuck')).toHaveCount(0)
  await expect(tuckButton(page, 'Tuck In')).toHaveCount(0)
})

test('tuck control: hidden when the response carries no ruling', async ({ page }) => {
  // A backend that predates the ruling sends no `tuck`. The SDK has no rules
  // of its own to fall back on, so the control stays hidden.
  await bootTopAndPants(page, () => undefined)

  await expect(tuckButton(page, 'Untuck')).toHaveCount(0)
})
