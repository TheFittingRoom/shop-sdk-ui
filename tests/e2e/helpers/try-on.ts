import type { Page, Route } from '@playwright/test'
import type { FirestoreUser } from '../../../src/api/gen/responses'
import { bootSdk } from './boot'
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
  TEST_VTO_COMPOSITION_12,
} from '../fixtures/seed'

// Boot helpers for the try-on screens, shared by the e2e specs and the
// screenshot scenes (tests/screenshots/).

// Quick view with a style, a size recommendation and a 12-frame render;
// `vtoPosts` counts the try-on requests and `sizeRecs` the size
// recommendation requests.
export function quickViewBoot(vtoPosts: { count: number } = { count: 0 }, sizeRecs: { count: number } = { count: 0 }) {
  return {
    apiOverrides: {
      sizeRecommendation: (route: Route) => {
        sizeRecs.count += 1
        return route.fulfill({ json: TEST_SIZE_FIT_RECOMMENDATION })
      },
      vtoComposition: (route: Route) => {
        vtoPosts.count += 1
        return route.fulfill({ json: TEST_VTO_COMPOSITION_12 })
      },
    },
    firestoreDocs: { styles: { 'style-1': TEST_SEEDED_STYLE } },
  }
}

// Frames shaped like real renders: portrait 2:3 (sim-vis renders 1000x1500).
// The default 1x1 mock frame is square, which letterboxes differently.
export const PORTRAIT_FRAME = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1500"><rect width="1000" height="1500" fill="#ccc"/></svg>',
)
export const portraitFrames = (route: Route) => route.fulfill({ contentType: 'image/svg+xml', body: PORTRAIT_FRAME })

// The host page has no viewport meta, so a phone profile would lay out 980px
// wide. The store has one; add it, so the phone layout is the real one.
export async function phoneViewport(page: Page) {
  await page.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      const meta = document.createElement('meta')
      meta.name = 'viewport'
      meta.content = 'width=device-width, initial-scale=1'
      document.head.prepend(meta)
    })
  })
}

// Style categories and groups for a T-shirt and a pair of pants.
const CATEGORIES = [
  {
    name: 'tshirt',
    label: 'T-Shirts',
    label_singular: 'T-Shirt',
    group: 'tops',
    layer_order: 60,
    tuckable: false,
    layer_order_untucked: 60,
    sleeve_selection: 'not_applicable',
    measurement_locations: [],
    additional_locations_full_sleeves: [],
    includes: [],
    excludes: [],
    is_container: false,
  },
  {
    name: 'pants',
    label: 'Pants',
    label_singular: 'Pant',
    group: 'bottoms',
    layer_order: 20,
    tuckable: false,
    layer_order_untucked: 20,
    sleeve_selection: 'not_applicable',
    measurement_locations: [],
    additional_locations_full_sleeves: [],
    includes: [],
    excludes: [],
    is_container: false,
  },
]
const GROUPS = [
  { name: 'tops', label: 'Tops', same_group_default: 'exclusive', display_order: 1 },
  { name: 'bottoms', label: 'Bottoms', same_group_default: 'exclusive', display_order: 2 },
]

// Opens the fitting room holding a T-shirt and a pair of pants, nothing selected.
export async function bootFittingRoom(page: Page, profile: FirestoreUser, frames?: (route: Route) => Promise<void>) {
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
      ],
    },
  )
  await bootSdk(page, {
    profile,
    productCatalog: [TEST_CURRENT_PRODUCT_B],
    firestoreDocs: { styles: { 'test-style': TEST_SEEDED_STYLE, 'test-style-b': TEST_SEEDED_STYLE_B } },
    apiOverrides: {
      sizeRecommendation: (route) =>
        route.fulfill({
          json: route.request().url().includes(`/styles/${TEST_STYLE_B_ID}/`)
            ? TEST_SIZE_FIT_RECOMMENDATION_B
            : TEST_SIZE_FIT_RECOMMENDATION,
        }),
      styleCategories: (route) => route.fulfill({ json: CATEGORIES }),
      styleCategoryGroups: (route) => route.fulfill({ json: GROUPS }),
      frames,
    },
  })
  await page.getByRole('button', { name: 'Fitting Room', exact: true }).click()
}
