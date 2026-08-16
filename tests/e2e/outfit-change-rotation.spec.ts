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

// Auto-rotate across an outfit *change* — two successive adds.
//
// This is the case the quick-view specs structurally cannot reach: quick-view
// fires one auto-rotate trigger per product, so a second trigger never arrives
// and old/new behaviour agree there. Two WEB-12 regressions reached demo for
// exactly that reason:
//
//   * the rotation anchored on whatever frame was displayed when the trigger
//     fired, so changing outfit mid-rotation adopted the angle the animation
//     happened to be passing through — parking shoppers on a back or side view
//     they never asked for;
//   * the reset to the anchor ran after the browser had already painted, so a
//     new outfit appeared at the previous one's angle and then visibly jumped.
//
// Both need an outfit to change while a rotation is in flight.

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
// A second category in its own group, so selecting the second product adds to
// the outfit instead of evicting the first.
const PANTS_CATEGORY = {
  ...TSHIRT_CATEGORY,
  name: 'pants',
  label: 'Pants',
  label_singular: 'Pant',
  group: 'bottoms',
  layer_order: 20,
  layer_order_untucked: 20,
}
const TOPS_GROUP = { name: 'tops', label: 'Tops', same_group_default: 'exclude', display_order: 1 }
const BOTTOMS_GROUP = { name: 'bottoms', label: 'Bottoms', same_group_default: 'exclude', display_order: 2 }

const FRAME_COUNT = 12

// Distinct frames per composition, keyed on the CSAs it contains. This is
// essential: if every composition returned the same frame paths the frame set
// would never change, the pre-paint snap would correctly not fire, and the test
// would prove nothing. Real compositions differ because the S3 path embeds a
// content hash of the composition.
function framesForItems(items: { colorway_size_asset_id: number }[]) {
  const token = items
    .map((i) => i.colorway_size_asset_id)
    .sort()
    .join('-')
  return {
    token: `tok-${token}`,
    frames: Array.from({ length: FRAME_COUNT }, (_, i) => `user-test/avatar-1/vto-${token}/frames/image_${i}.png`),
  }
}

function frameIndexFromSrc(src: string | null): number | null {
  return src?.match(/image_(\d+)\.png/) ? Number(src.match(/image_(\d+)\.png/)?.[1]) : null
}

function tokenFromSrc(src: string | null): string | null {
  return src?.match(/\/vto-([^/]+)\//)?.[1] ?? null
}

// Assert a rotation actually runs a full revolution and settles on `anchor`.
// Both halves matter: the frame set is *displayed* at the anchor from the
// start, so asserting only the final position would pass without any rotation
// having happened at all.
async function expectFullRevolutionBackTo(page: Page, anchor: number) {
  const avatar = page.locator('img[src*="/vto-"]')
  const index = async () => frameIndexFromSrc(await avatar.getAttribute('src'))
  // Away from the anchor first, then back to it. Deliberately not asserting a
  // *specific* intermediate frame: at ~333ms per frame, polling routinely skips
  // individual ones. The rotation only sits on the anchor at its start and its
  // end, so "left it, then returned" is a sound revolution check and is immune
  // to sampling.
  await expect.poll(index, { timeout: 8000 }).not.toBe(anchor)
  await expect.poll(index, { timeout: 10000 }).toBe(anchor)
}

// Two selectable rail cards, different products in different style categories,
// so the second ADDS to the outfit rather than evicting the first.
async function bootTwoProductFittingRoom(page: Page) {
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
      // Routed by style id: the two products are genuinely different styles
      // with different recommendations and CSAs.
      sizeRecommendation: (route) =>
        route.fulfill({
          json: route.request().url().includes(`/styles/${TEST_STYLE_B_ID}/`)
            ? TEST_SIZE_FIT_RECOMMENDATION_B
            : TEST_SIZE_FIT_RECOMMENDATION,
        }),
      styleCategories: (route) => route.fulfill({ json: [TSHIRT_CATEGORY, PANTS_CATEGORY] }),
      styleCategoryGroups: (route) => route.fulfill({ json: [TOPS_GROUP, BOTTOMS_GROUP] }),
      vtoComposition: (route) => {
        const body = route.request().postDataJSON() as { items: { colorway_size_asset_id: number }[] }
        return route.fulfill({ json: framesForItems(body.items) })
      },
    },
  })

  await page.getByRole('button', { name: 'Fitting Room', exact: true }).click()
}

// Waits for a composition other than `oldToken` to reach the DOM and returns
// the FIRST src it appears with. Polled inside the page and tightly, because
// the offending state persisted only until the rotation started.
async function firstSrcOfNextComposition(page: Page, oldToken: string | null): Promise<string | null> {
  return page.evaluate(
    async ({ oldToken }) => {
      const deadline = Date.now() + 15000
      while (Date.now() < deadline) {
        const src = document.querySelector('img[src*="/vto-"]')?.getAttribute('src') ?? ''
        const token = src.match(/\/vto-([^/]+)\//)?.[1] ?? null
        if (token && token !== oldToken) {
          return src
        }
        await new Promise((r) => setTimeout(r, 5))
      }
      return null
    },
    { oldToken },
  )
}

test('fitting room: changing outfit mid-rotation shows the new outfit front-facing', async ({ page }) => {
  await bootTwoProductFittingRoom(page)
  const avatar = page.locator('img[src*="/vto-"]')

  await page.getByRole('button', { name: /Test Product/i }).click()
  await expect(avatar).toHaveAttribute('src', /image_0\.png/, { timeout: 10000 })
  const firstToken = tokenFromSrc(await avatar.getAttribute('src'))

  // Let the rotation get well away from frame 0, so "front-facing" below can
  // only be the result of a deliberate reset.
  await expect
    .poll(async () => frameIndexFromSrc(await avatar.getAttribute('src')), { timeout: 5000 })
    .toBeGreaterThanOrEqual(2)

  // Change the outfit WHILE that rotation is mid-flight.
  await page.getByRole('button', { name: /Second Product/i }).click()

  const firstSrc = await firstSrcOfNextComposition(page, firstToken)
  expect(firstSrc, 'the new composition never appeared').not.toBeNull()
  expect(
    frameIndexFromSrc(firstSrc),
    'a new outfit must appear front-facing, not at the angle the previous rotation was passing through',
  ).toBe(0)

  // And its own rotation runs a full revolution and settles back on the front,
  // since the shopper never touched the spin controls.
  await expectFullRevolutionBackTo(page, 0)
})

test('fitting room: a manually chosen angle survives an outfit change', async ({ page }) => {
  // The other half of the anchor contract: once the shopper has moved the frame
  // themselves, their angle is the one that persists — a new outfit appears at
  // it and settles back on it, rather than resetting to the front.
  await bootTwoProductFittingRoom(page)
  const avatar = page.locator('img[src*="/vto-"]')

  await page.getByRole('button', { name: /Test Product/i }).click()
  await expect(avatar).toHaveAttribute('src', /image_0\.png/, { timeout: 10000 })

  // Let the first rotation run its course so the avatar is genuinely at rest
  // before interacting — not merely sitting on frame 0 before it starts.
  await expectFullRevolutionBackTo(page, 0)
  const firstToken = tokenFromSrc(await avatar.getAttribute('src'))

  // Rotate by hand to frame 2. Each click also cancels auto-rotate, so the
  // avatar stays put and frame 2 becomes the anchor.
  const rotateRight = page.getByRole('button', { name: 'Rotate right', exact: true })
  await rotateRight.click()
  await rotateRight.click()
  await expect(avatar).toHaveAttribute('src', /image_2\.png/, { timeout: 2000 })

  await page.getByRole('button', { name: /Second Product/i }).click()

  const firstSrc = await firstSrcOfNextComposition(page, firstToken)
  expect(firstSrc, 'the new composition never appeared').not.toBeNull()
  expect(frameIndexFromSrc(firstSrc), "a new outfit must appear at the shopper's chosen angle").toBe(2)

  await expectFullRevolutionBackTo(page, 2)
})
