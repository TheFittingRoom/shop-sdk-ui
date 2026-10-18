import type { Page } from '@playwright/test'
import { devices, expect, test } from '@playwright/test'
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

// Help popups (src/lib/help-tips.ts): each is shown once per browser, and only
// one is ever on screen — the next waits until the current one is dismissed.

const STORAGE_KEY = 'tfr:help-tips:v1'

const TOP_CATEGORY = {
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
}
const PANTS_CATEGORY = {
  ...TOP_CATEGORY,
  name: 'pants',
  label: 'Pants',
  label_singular: 'Pant',
  group: 'bottoms',
  layer_order: 100,
  layer_order_untucked: 100,
}
const TOPS_GROUP = { name: 'tops', label: 'Tops', same_group_default: 'exclude', display_order: 1 }
const BOTTOMS_GROUP = { name: 'bottoms', label: 'Bottoms', same_group_default: 'exclude', display_order: 2 }

const tip = (page: Page, text: string) => page.getByRole('dialog', { name: text })
const anyTip = (page: Page) => page.locator('[data-tfr-help-tooltip]')

const CARD_TIP = 'Tap the cards you want to try on'
const TRY_IT_ON_TIP = 'Tap here to see your outfit!'
const ROTATE_TIP = 'Tap the arrows to rotate your avatar'
const SWIPE_TIP = 'Swipe up to change sizes'
const BACK_TIP = 'Tap here to go back to your items'
const DETAIL_EXPAND_TIP = 'Click to see item details'

// Marks the given popups seen before the page loads.
async function seedSeen(page: Page, ids: string[]) {
  await page.addInitScript(
    ({ key, ids }) => {
      window.localStorage.setItem(key, JSON.stringify(Object.fromEntries(ids.map((id) => [id, true]))))
    },
    { key: STORAGE_KEY, ids },
  )
}

// A fitting room holding two products in different groups, with popups on.
async function bootFittingRoom(page: Page) {
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
    helpTips: true,
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
    },
  })
}

test('store widgets: their popups take turns instead of showing together', async ({ page }) => {
  await bootSdk(page, { helpTips: true })

  // The hanger goes first, the header icon after it.
  await expect(tip(page, 'Add item to your fitting room here')).toBeVisible()
  await expect(anyTip(page)).toHaveCount(1)

  await tip(page, 'Add item to your fitting room here').getByRole('button', { name: 'Dismiss' }).click()
  await expect(tip(page, 'See items added to your fitting room here')).toBeVisible()
  await expect(anyTip(page)).toHaveCount(1)
})

test('store widgets: a visitor who saw the old popups is not shown them again', async ({ page }) => {
  // The flags the two widgets kept before the shared record existed.
  await page.addInitScript(() => {
    window.localStorage.setItem('tfr:first-visit-tooltip-seen:v1', 'true')
    window.localStorage.setItem('tfr:first-add-tooltip-seen:v1', 'true')
  })
  await bootSdk(page, { helpTips: true })

  await expect(page.getByRole('button', { name: 'Fitting Room', exact: true })).toBeVisible()
  await page.waitForTimeout(1000)
  await expect(anyTip(page)).toHaveCount(0)
})

test('desktop fitting room: card popup, then the rotate popup once an outfit renders', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await seedSeen(page, ['fitting_room_icon', 'add_to_fitting_room'])
  await bootFittingRoom(page)
  await page.getByRole('button', { name: 'Fitting Room', exact: true }).click()

  await expect(tip(page, CARD_TIP)).toBeVisible()
  await expect(anyTip(page)).toHaveCount(1)

  // Tapping a card is doing what the popup asked: it goes, and the next one
  // (the arrows, once the outfit's frames are up) takes its place.
  await page.getByRole('button', { name: /Test Product/i }).click()
  await expect(tip(page, CARD_TIP)).toHaveCount(0)
  await expect(tip(page, ROTATE_TIP)).toBeVisible({ timeout: 10000 })
  await expect(anyTip(page)).toHaveCount(1)

  await tip(page, ROTATE_TIP).getByRole('button', { name: 'Dismiss' }).click()
  await expect(anyTip(page)).toHaveCount(0)

  // Each was recorded on its own, and neither comes back as the shopper
  // keeps using the room.
  const stored = await page.evaluate((key) => window.localStorage.getItem(key), STORAGE_KEY)
  expect(JSON.parse(stored ?? '{}')).toMatchObject({ fitting_room_card: true, avatar_rotate: true })
  await page.getByRole('button', { name: /Test Product/i }).click()
  await page.getByRole('button', { name: /Test Product/i }).click()
  await page.waitForTimeout(1500)
  await expect(anyTip(page)).toHaveCount(0)
})

test('desktop fitting room: the first collapsed row gets the expand popup', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await seedSeen(page, ['fitting_room_icon', 'add_to_fitting_room', 'fitting_room_card', 'avatar_rotate'])
  await bootFittingRoom(page)
  await page.getByRole('button', { name: 'Fitting Room', exact: true }).click()

  // One item selected: it is the open row, there is nothing collapsed.
  await page.getByRole('button', { name: /Test Product/i }).click()
  await page.waitForTimeout(1000)
  await expect(anyTip(page)).toHaveCount(0)

  // The second one opens and the first collapses; its chevron gets the popup.
  await page.getByRole('button', { name: /Second Product/i }).click()
  await expect(tip(page, DETAIL_EXPAND_TIP)).toBeVisible()
  await expect(anyTip(page)).toHaveCount(1)
  const chevron = await page
    .getByRole('button', { name: /^T-Shirt/ })
    .locator('span')
    .last()
    .boundingBox()
  const popup = await tip(page, DETAIL_EXPAND_TIP).boundingBox()
  expect(chevron && popup && popup.y > chevron.y).toBe(true)

  // Opening it is what the popup asked for.
  await page.getByRole('button', { name: /^T-Shirt/ }).click()
  await expect(anyTip(page)).toHaveCount(0)
})

test('a popup closes on its own after 4 seconds and the next takes over', async ({ page }) => {
  await bootSdk(page, { helpTips: true })

  await expect(tip(page, 'Add item to your fitting room here')).toBeVisible()
  await page.waitForTimeout(3000)
  await expect(tip(page, 'Add item to your fitting room here')).toBeVisible()
  await expect(tip(page, 'Add item to your fitting room here')).toHaveCount(0, { timeout: 2000 })
  const stored = await page.evaluate((key) => window.localStorage.getItem(key), STORAGE_KEY)
  expect(JSON.parse(stored ?? '{}')).toMatchObject({ add_to_fitting_room: true })
  await expect(tip(page, 'See items added to your fitting room here')).toBeVisible()
})

test.describe('mobile', () => {
  // The SDK picks its mobile layout from the user agent and touch support,
  // not the viewport width alone.
  const { defaultBrowserType: _browser, ...pixel5 } = devices['Pixel 5']
  test.use(pixel5)

  test('mobile fitting room: cards → try it on → arrows → swipe up → back', async ({ page }) => {
    await seedSeen(page, ['fitting_room_icon', 'add_to_fitting_room'])
    await bootFittingRoom(page)
    await page.getByRole('button', { name: 'Fitting Room', exact: true }).click()

    await expect(tip(page, CARD_TIP)).toBeVisible()
    // Nothing is selected yet, so the try-it-on popup isn't waiting either.
    await page.getByRole('button', { name: /Test Product/i }).click()
    await expect(tip(page, TRY_IT_ON_TIP)).toBeVisible()
    await expect(anyTip(page)).toHaveCount(1)

    await page.getByRole('button', { name: 'Try it on', exact: true }).click()
    await expect(tip(page, ROTATE_TIP)).toBeVisible({ timeout: 10000 })
    await expect(anyTip(page)).toHaveCount(1)

    await tip(page, ROTATE_TIP).getByRole('button', { name: 'Dismiss' }).click()
    await expect(tip(page, SWIPE_TIP)).toBeVisible()
    await expect(anyTip(page)).toHaveCount(1)

    // Then the back button, which returns to the cards.
    await tip(page, SWIPE_TIP).getByRole('button', { name: 'Dismiss' }).click()
    await expect(tip(page, BACK_TIP)).toBeVisible()
    await expect(anyTip(page)).toHaveCount(1)
    await page.getByRole('button', { name: 'Back to browse' }).click()
    await expect(anyTip(page)).toHaveCount(0)
  })
})
