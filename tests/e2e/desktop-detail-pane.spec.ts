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

// The desktop fitting room's centre pane: it doesn't scroll as a whole —
// every selected item's row stays on screen, the open item fills what's left
// and scrolls inside itself — and "Add all to cart" sits at its bottom.

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

const addAll = (page: Page) => page.getByRole('button', { name: 'Add all to cart' })

// What the backend sends when no size fits: a 200 with an empty
// recommendation (get_size_recommendation.go).
const NO_FIT_RECOMMENDATION = {
  fit_classification: '',
  recommended_size: { id: 0 },
  available_sizes: [],
  fits: [],
}

// Opens the fitting room with both test products in it, and — on desktop —
// both selected. `height` null leaves the viewport to the device profile.
// `secondProductRecommendation` replaces Second Product's size recommendation.
async function bootWithBothSelected(
  page: Page,
  height: number | null = 900,
  secondProductRecommendation: unknown = TEST_SIZE_FIT_RECOMMENDATION_B,
) {
  if (height !== null) {
    await page.setViewportSize({ width: 1440, height })
  }
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
            ? secondProductRecommendation
            : TEST_SIZE_FIT_RECOMMENDATION,
        }),
      styleCategories: (route) => route.fulfill({ json: [TOP_CATEGORY, PANTS_CATEGORY] }),
      styleCategoryGroups: (route) => route.fulfill({ json: [TOPS_GROUP, BOTTOMS_GROUP] }),
    },
  })
  await page.getByRole('button', { name: 'Fitting Room', exact: true }).click()
  await page.getByRole('button', { name: /Test Product/i }).click()
  await page.getByRole('button', { name: /Second Product/i }).click()
  if (height !== null) {
    await expect(addAll(page)).toBeVisible()
  }
}

test('detail pane: every row stays on screen, the open item scrolls inside itself', async ({ page }) => {
  // Short enough that the open item's content can't fit.
  await bootWithBothSelected(page, 620)
  await expect(page.getByText('Recommended Size:')).toBeVisible()

  const layout = await addAll(page).evaluate((button) => {
    const pane = button.parentElement as HTMLElement
    const fit = [...pane.querySelectorAll('*')].find((el) => el.textContent?.startsWith('Recommended Size:'))
    let body: HTMLElement | null = fit as HTMLElement
    while (body && getComputedStyle(body).overflowY !== 'auto') {
      body = body.parentElement
    }
    const paneRect = pane.getBoundingClientRect()
    const buttonRect = button.getBoundingClientRect()
    return {
      paneScrolls: pane.scrollHeight > pane.clientHeight + 1,
      bodyIsInsidePane: !!body && body !== pane && pane.contains(body),
      bodyScrolls: !!body && body.scrollHeight > body.clientHeight + 1,
      buttonAtBottom: paneRect.bottom - buttonRect.bottom < 40,
    }
  })
  expect(layout.paneScrolls, 'the pane itself must not scroll').toBe(false)
  expect(layout.bodyIsInsidePane, "the open item's body is its own scroll area").toBe(true)
  expect(layout.bodyScrolls, "the open item's content overflows and scrolls inside it").toBe(true)
  expect(layout.buttonAtBottom, 'Add all sits at the bottom of the pane').toBe(true)

  // Both rows' headers are on screen at once.
  await expect(page.getByRole('button', { name: /^T-Shirt/ })).toBeInViewport()
  await expect(page.getByRole('button', { name: /^Pant/ })).toBeInViewport()
})

test('add all to cart: adds every selected item, one at a time, then closes', async ({ page }) => {
  await bootWithBothSelected(page)
  await addAll(page).click()

  await expect(addAll(page)).toHaveCount(0)
  const adds = await page.evaluate(
    () => (window as unknown as { __TFR_TEST_ADDS__?: { externalId: string }[] }).__TFR_TEST_ADDS__ ?? [],
  )
  expect(adds.map((a) => a.externalId)).toEqual([TEST_PRODUCT_EXTERNAL_ID, TEST_PRODUCT_B_EXTERNAL_ID])
})

test('add all to cart: an item that fails keeps the overlay open with an error', async ({ page }) => {
  await bootWithBothSelected(page)
  await page.evaluate((id) => {
    ;(window as unknown as { __TFR_TEST_ADD_FAIL__: string[] }).__TFR_TEST_ADD_FAIL__ = [id]
  }, TEST_PRODUCT_EXTERNAL_ID)

  await addAll(page).click()

  await expect(page.getByText("Some items couldn't be added to your cart. Please try again.")).toBeVisible()
  // The store's own reason, from Shopify's error body.
  await expect(page.getByText('Cannot find variant')).toBeVisible()
  await expect(addAll(page)).toBeVisible()
  // The failure didn't stop the rest going in.
  const adds = await page.evaluate(
    () => (window as unknown as { __TFR_TEST_ADDS__?: { externalId: string }[] }).__TFR_TEST_ADDS__ ?? [],
  )
  expect(adds.map((a) => a.externalId)).toEqual([TEST_PRODUCT_B_EXTERNAL_ID])
})

const failAdd = (page: Page, externalId: string, text?: string) =>
  page.evaluate(
    ({ externalId, text }) => {
      const w = window as unknown as { __TFR_TEST_ADD_FAIL__: string[]; __TFR_TEST_ADD_FAIL_TEXT__?: string }
      w.__TFR_TEST_ADD_FAIL__ = [externalId]
      if (text) {
        w.__TFR_TEST_ADD_FAIL_TEXT__ = text
      }
    },
    { externalId, text },
  )

test("add to cart: a failed add stays open and shows the store's reason", async ({ page }) => {
  await bootWithBothSelected(page)
  // Second Product is the open item (the last one selected).
  await failAdd(page, TEST_PRODUCT_B_EXTERNAL_ID)

  // Scoped to the overlay: the host page has its own Add to cart button.
  await page.getByRole('dialog').getByRole('button', { name: 'Add to cart', exact: true }).click()

  await expect(page.getByText("Couldn't add this item to your cart. Please try again.")).toBeVisible()
  await expect(page.getByText('Cannot find variant')).toBeVisible()
  await expect(addAll(page)).toBeVisible()
})

test('add to cart: an error with no store reason in it shows only our message', async ({ page }) => {
  await bootWithBothSelected(page)
  await failAdd(page, TEST_PRODUCT_B_EXTERNAL_ID, '[TFR] addToCart: no variant matches size=M color=Black')

  // Scoped to the overlay: the host page has its own Add to cart button.
  await page.getByRole('dialog').getByRole('button', { name: 'Add to cart', exact: true }).click()

  await expect(page.getByText("Couldn't add this item to your cart. Please try again.")).toBeVisible()
  // Developer detail from the callback never reaches the shopper.
  await expect(page.getByText(/no variant matches/)).toHaveCount(0)
})

const NO_FIT_MESSAGE = 'There are currently no well fitting sizes available for this item.'

test('detail pane: an item with no fitting size says so instead of loading forever', async ({ page }) => {
  await bootWithBothSelected(page, 900, NO_FIT_RECOMMENDATION)

  // Second Product is the open row; nothing in it can load.
  await expect(page.getByText(NO_FIT_MESSAGE)).toBeVisible()
  await expect(page.getByText('Loading...', { exact: true })).toHaveCount(0)

  // Collapsed, the row still says so rather than showing an empty strip.
  await page.getByRole('button', { name: /^Pant/ }).click()
  await expect(page.getByText(NO_FIT_MESSAGE)).toBeVisible()
})

test('add all to cart: disabled while the selection holds an item with no fitting size', async ({ page }) => {
  await bootWithBothSelected(page, 900, NO_FIT_RECOMMENDATION)
  await expect(page.getByText(NO_FIT_MESSAGE)).toBeVisible()
  await expect(addAll(page)).toBeDisabled()

  // Deselecting it leaves an outfit that can all go in.
  await page.getByRole('button', { name: /Second Product/i }).click()
  await expect(addAll(page)).toBeEnabled()
  await addAll(page).click()
  await expect(addAll(page)).toHaveCount(0)
  const adds = await page.evaluate(
    () => (window as unknown as { __TFR_TEST_ADDS__?: { externalId: string }[] }).__TFR_TEST_ADDS__ ?? [],
  )
  expect(adds.map((a) => a.externalId)).toEqual([TEST_PRODUCT_EXTERNAL_ID])
})

test.describe('mobile', () => {
  const { defaultBrowserType: _browser, ...pixel5 } = devices['Pixel 5']
  test.use(pixel5)

  // Swipes the try-on sheet up one snap from its handle row.
  async function swipeSheetUp(page: Page) {
    await page.getByText('RECOMMENDED SIZES').evaluate((handle) => {
      const rect = handle.getBoundingClientRect()
      const x = rect.left + rect.width / 2
      const y = rect.top + rect.height / 2
      const touch = (clientY: number) => new Touch({ identifier: 1, target: handle, clientX: x, clientY })
      handle.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, touches: [touch(y)] }))
      document.dispatchEvent(new TouchEvent('touchmove', { bubbles: true, touches: [touch(y - 80)] }))
      document.dispatchEvent(new TouchEvent('touchend', { bubbles: true, touches: [] }))
    })
  }

  test('try-on sheet: Add all to cart sits after the product rows and adds them all', async ({ page }) => {
    await bootWithBothSelected(page, null)
    await page.getByRole('button', { name: 'Try it on', exact: true }).click()

    // Collapsed, the sheet shows no rows — and no button.
    await expect(addAll(page)).toHaveCount(0)
    await swipeSheetUp(page)
    await expect(addAll(page)).toBeVisible()

    // After the last product row.
    const order = await addAll(page).evaluate((button) => {
      const pant = [...document.querySelectorAll('button')].find((b) => b.textContent?.startsWith('Pant'))
      return pant ? pant.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING : 0
    })
    expect(order, 'the button comes after the product rows').toBeTruthy()

    await addAll(page).click()
    await expect(addAll(page)).toHaveCount(0)
    const adds = await page.evaluate(
      () => (window as unknown as { __TFR_TEST_ADDS__?: { externalId: string }[] }).__TFR_TEST_ADDS__ ?? [],
    )
    expect(adds.map((a) => a.externalId)).toEqual([TEST_PRODUCT_EXTERNAL_ID, TEST_PRODUCT_B_EXTERNAL_ID])
  })

  test('try-on sheet: an item with no fitting size says so', async ({ page }) => {
    await bootWithBothSelected(page, null, NO_FIT_RECOMMENDATION)
    await page.getByRole('button', { name: 'Try it on', exact: true }).click()
    await swipeSheetUp(page)

    await expect(page.getByText(NO_FIT_MESSAGE)).toBeVisible()
    await expect(addAll(page)).toBeDisabled()
  })
})

// --- "More below" cue on the open item -------------------------------------

const moreBelow = (page: Page) => page.getByRole('button', { name: 'Scroll down' })

// Runs `fn` against the open item's scrolling body.
function onOpenBody<T>(page: Page, fn: (body: HTMLElement) => T) {
  return page.getByText('Recommended Size:').evaluate((el, src) => {
    let body: HTMLElement | null = el as HTMLElement
    while (body && getComputedStyle(body).overflowY !== 'auto') {
      body = body.parentElement
    }
    if (!body) {
      throw new Error('no scrolling body')
    }
    return (new Function('body', `return (${src})(body)`) as (b: HTMLElement) => T)(body)
  }, fn.toString())
}

test('open item: a fade and Scroll down button while there is more below', async ({ page }) => {
  await bootWithBothSelected(page, 620)
  await expect(page.getByText('Recommended Size:')).toBeVisible()
  await expect(moreBelow(page)).toBeVisible()

  // The styled scrollbar. Playwright's headless Chromium runs with
  // --hide-scrollbars, so the bar takes no width here; check the rule that
  // makes Chrome and Safari draw a permanent one is on the body instead.
  const scrollbarRule = await onOpenBody(page, (b) => {
    const root = b.getRootNode() as Document | ShadowRoot
    const sheets = [...root.styleSheets, ...(root.adoptedStyleSheets ?? [])]
    for (const sheet of sheets) {
      for (const rule of [...sheet.cssRules]) {
        const r = rule as CSSStyleRule
        if (!r.selectorText?.includes('::-webkit-scrollbar') || r.selectorText.includes('-thumb')) {
          continue
        }
        if (r.selectorText.includes('-track')) {
          continue
        }
        const cls = r.selectorText.split('::')[0].replace(/^\./, '')
        if (b.classList.contains(cls)) {
          return r.style.width
        }
      }
    }
    return null
  })
  expect(scrollbarRule).toBe('8px')

  // The button scrolls the body down.
  await moreBelow(page).click()
  await expect.poll(() => onOpenBody(page, (b) => b.scrollTop)).toBeGreaterThan(100)

  // At the bottom there is nothing more, so the cue goes.
  await onOpenBody(page, (b) => {
    b.scrollTop = b.scrollHeight
  })
  await expect(moreBelow(page)).toHaveCount(0)
})

test('open item: the fade does not block what is under it', async ({ page }) => {
  await bootWithBothSelected(page, 620)
  await expect(moreBelow(page)).toBeVisible()
  const hit = await page.evaluate(() => {
    const button = [...document.querySelectorAll('button')].find((b) => b.getAttribute('aria-label') === 'Scroll down')
    const fade = button?.parentElement
    if (!fade) {
      return null
    }
    const r = fade.getBoundingClientRect()
    // A point in the fade, well clear of the button.
    const target = document.elementFromPoint(r.left + 10, r.top + r.height / 2)
    return { fadeIsTarget: target === fade || fade.contains(target) }
  })
  expect(hit).toEqual({ fadeIsTarget: false })
})

test('open item: no cue when everything fits', async ({ page }) => {
  await bootWithBothSelected(page, 1600)
  await expect(page.getByText('Recommended Size:')).toBeVisible()
  expect(await onOpenBody(page, (b) => b.scrollHeight <= b.clientHeight + 1)).toBe(true)
  await expect(moreBelow(page)).toHaveCount(0)
})
