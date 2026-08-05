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

// Regression guard for the stale-stored-CSA fallback. A merchant's product page
// persists a "fitting room item" that references a colorway-size-asset by its
// integer id. If the style is re-saved/re-published and that CSA row is
// replaced, the stored id goes stale — it's no longer in the current size rec.
// Before the fix the SDK sent the stale id straight to POST /v1/vto-compositions
// and the render broke. Now `resolveItem` flags it (needsResize), the wire-item
// builder drops it so the stale id is never posted, and `ensureSizeForItem`
// re-resolves it to the DEFAULT — the recommended size + first/preferred
// colorway — persisting the correction. This test seeds a stale id, selects the
// item, and asserts the VTO request carries the recommended CSA (5001), not the
// stale one, and that the correction was written back to storage.

// From TEST_SIZE_FIT_RECOMMENDATION: recommended size M -> CSA 5001.
const RECOMMENDED_CSA_ID = 5001
// An id deliberately absent from the size rec (available CSAs are 5001, 5002).
const STALE_CSA_ID = 999999

// Minimal style-category wiring so the stored item resolves a styleCategory and
// its rail card becomes selectable (a card with no category renders disabled).
// TEST_SEEDED_STYLE.style_category_name is 'tshirt'.
const TSHIRT_CATEGORY = {
  name: 'tshirt',
  label: 'T-Shirts',
  label_singular: 'T-Shirt',
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

test('fitting room: a stale stored CSA id falls back to the recommended size + first colorway', async ({ page }) => {
  const capturedVtoItems: Array<{ colorway_size_asset_id: number; untucked?: boolean }[]> = []

  // Seed a fitting-room item whose stored CSA id is stale (before the SDK boots
  // and reads localStorage). Bucketed by (brandId, uid) exactly as the SDK writes.
  await page.addInitScript(
    ({ brandId, uid, externalId, handle, staleCsa }) => {
      const item = { externalId, handle, size: 'M', color: 'Blue', colorwaySizeAssetId: staleCsa, addedAt: 1 }
      const data = { [String(brandId)]: { [uid]: [item] } }
      window.localStorage.setItem('tfr:fitting-room:v1', JSON.stringify(data))
    },
    {
      brandId: TEST_BRAND_ID,
      uid: TEST_UID,
      externalId: TEST_PRODUCT_EXTERNAL_ID,
      handle: TEST_PRODUCT_HANDLE,
      staleCsa: STALE_CSA_ID,
    },
  )

  await bootSdk(page, {
    firestoreDocs: { styles: { 'test-style': TEST_SEEDED_STYLE } },
    apiOverrides: {
      sizeRecommendation: (route) => route.fulfill({ json: TEST_SIZE_FIT_RECOMMENDATION }),
      styleCategories: (route) => route.fulfill({ json: [TSHIRT_CATEGORY] }),
      styleCategoryGroups: (route) => route.fulfill({ json: [TOPS_GROUP] }),
      vtoComposition: async (route) => {
        const body = route.request().postDataJSON() as { items: (typeof capturedVtoItems)[number] }
        capturedVtoItems.push(body.items)
        await route.fulfill({ json: TEST_VTO_COMPOSITION })
      },
    },
  })

  // Open the overlay and select the stored (stale) item. The card body button's
  // accessible name is the product name.
  await page.getByRole('button', { name: 'Fitting Room', exact: true }).click()
  await page.getByRole('button', { name: /Test Product/i }).click()

  // The VTO request must carry the recommended CSA, never the stale id.
  await expect.poll(() => capturedVtoItems.length, { timeout: 8000 }).toBeGreaterThanOrEqual(1)
  const ids = capturedVtoItems[0].map((i) => i.colorway_size_asset_id)
  expect(ids).toContain(RECOMMENDED_CSA_ID)
  expect(ids).not.toContain(STALE_CSA_ID)

  // The correction was persisted back to storage, so a reload doesn't re-stale.
  const persistedCsaId = await page.evaluate(
    ({ brandId, uid }) => {
      const raw = window.localStorage.getItem('tfr:fitting-room:v1')
      if (!raw) {
        return null
      }
      const parsed = JSON.parse(raw) as Record<string, Record<string, { colorwaySizeAssetId: number | null }[]>>
      return parsed[String(brandId)]?.[uid]?.[0]?.colorwaySizeAssetId ?? null
    },
    { brandId: TEST_BRAND_ID, uid: TEST_UID },
  )
  expect(persistedCsaId).toBe(RECOMMENDED_CSA_ID)
})
