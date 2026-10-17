import type { Page } from '@playwright/test'
import { devices, expect, test } from '@playwright/test'
import { bootSdk } from './helpers/boot'
import { TEST_SEEDED_STYLE, TEST_SIZE_FIT_RECOMMENDATION, TEST_VTO_COMPOSITION_12 } from './fixtures/seed'

// Pinch-zoom on the VTO frame (usePinchZoom, in AvatarFrameViewer): two
// fingers zoom, one finger pans while zoomed instead of rotating, and a
// double tap or pinching back to 1× undoes it.

const { defaultBrowserType: _browser, ...pixel5 } = devices['Pixel 5']
test.use(pixel5)

const BOOT = {
  apiOverrides: {
    sizeRecommendation: (route: { fulfill: (r: { json: unknown }) => Promise<void> }) =>
      route.fulfill({ json: TEST_SIZE_FIT_RECOMMENDATION }),
    vtoComposition: (route: { fulfill: (r: { json: unknown }) => Promise<void> }) =>
      route.fulfill({ json: TEST_VTO_COMPOSITION_12 }),
  },
  firestoreDocs: { styles: { 'style-1': TEST_SEEDED_STYLE } },
}

const avatar = (page: Page) => page.locator('img[src*="image_"]')

// Dispatches one touch event on the avatar image with the given fingers down,
// as offsets from the image's centre. Fingers keep their identifier by index.
async function touch(page: Page, type: 'touchstart' | 'touchmove' | 'touchend', fingers: [number, number][]) {
  await avatar(page).evaluate(
    (img, { type, fingers }) => {
      const rect = img.getBoundingClientRect()
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2
      const touches = fingers.map(
        ([dx, dy], identifier) => new Touch({ identifier, target: img, clientX: cx + dx, clientY: cy + dy }),
      )
      img.dispatchEvent(
        new TouchEvent(type, {
          bubbles: true,
          cancelable: true,
          touches,
          targetTouches: touches,
          changedTouches: touches,
        }),
      )
    },
    { type, fingers },
  )
}

// A two-finger pinch from `from` px apart to `to` px apart, horizontally
// about the image's centre.
async function pinch(page: Page, from: number, to: number) {
  await touch(page, 'touchstart', [
    [-from / 2, 0],
    [from / 2, 0],
  ])
  for (let i = 1; i <= 5; i++) {
    const d = from + ((to - from) * i) / 5
    await touch(page, 'touchmove', [
      [-d / 2, 0],
      [d / 2, 0],
    ])
  }
  await touch(page, 'touchend', [])
}

async function scaleOf(page: Page): Promise<number> {
  const transform = await avatar(page).evaluate((img) => (img as HTMLElement).style.transform)
  const m = transform.match(/scale\(([\d.]+)\)/)
  return m ? Number(m[1]) : 1
}

async function openQuickView(page: Page) {
  await bootSdk(page, BOOT)
  await page.getByRole('button', { name: /quick view/i }).click()
  await expect(avatar(page)).toHaveAttribute('src', /image_\d+\.png/, { timeout: 5000 })
}

test('pinch zooms the frame, and pinching back to 1× undoes it', async ({ page }) => {
  await openQuickView(page)

  await pinch(page, 100, 250)
  expect(await scaleOf(page)).toBeCloseTo(2.5, 1)

  await pinch(page, 250, 100)
  await expect(avatar(page)).toHaveJSProperty('style.transform', '')
})

test('zoom is capped at 4×', async ({ page }) => {
  await openQuickView(page)
  await pinch(page, 40, 300)
  expect(await scaleOf(page)).toBe(4)
})

test('one finger pans a zoomed frame instead of rotating it, and a double tap resets', async ({ page }) => {
  await openQuickView(page)
  await pinch(page, 100, 300)
  // The pinch took control, so the auto-rotate is stopped: the frame on
  // screen is the one to hold.
  const src = await avatar(page).getAttribute('src')
  const before = await avatar(page).evaluate((img) => (img as HTMLElement).style.transform)

  await touch(page, 'touchstart', [[0, 0]])
  await touch(page, 'touchmove', [[40, 30]])
  await touch(page, 'touchmove', [[80, 60]])
  await touch(page, 'touchend', [])

  const after = await avatar(page).evaluate((img) => (img as HTMLElement).style.transform)
  expect(after).not.toBe(before)
  expect(await scaleOf(page)).toBeCloseTo(3, 1)
  await page.waitForTimeout(700)
  expect(await avatar(page).getAttribute('src'), 'panning must not rotate the frame').toBe(src)

  await touch(page, 'touchstart', [[0, 0]])
  await touch(page, 'touchend', [])
  await touch(page, 'touchstart', [[0, 0]])
  await touch(page, 'touchend', [])
  await expect(avatar(page)).toHaveJSProperty('style.transform', '')
})

test('a second finger landing mid-drag turns the drag into a pinch, not a rotation', async ({ page }) => {
  await openQuickView(page)
  // Stop the auto-rotate first so any frame change below is the drag's.
  await page.getByRole('button', { name: 'Rotate right' }).click()
  const src = await avatar(page).getAttribute('src')

  await touch(page, 'touchstart', [[-50, 0]])
  await touch(page, 'touchmove', [[-58, 0]])
  await touch(page, 'touchstart', [
    [-58, 0],
    [50, 0],
  ])
  for (const d of [140, 180, 220]) {
    await touch(page, 'touchmove', [
      [-d / 2, 0],
      [d / 2, 0],
    ])
  }
  await touch(page, 'touchend', [])

  expect(await scaleOf(page)).toBeGreaterThan(1.5)
  expect(await avatar(page).getAttribute('src'), 'a pinch must not rotate the frame').toBe(src)
})

test('unzoomed, a one-finger swipe still rotates', async ({ page }) => {
  await openQuickView(page)
  await page.getByRole('button', { name: 'Rotate right' }).click()
  const src = await avatar(page).getAttribute('src')

  await touch(page, 'touchstart', [[0, 0]])
  for (const dx of [20, 60, 100]) {
    await touch(page, 'touchmove', [[dx, 0]])
  }
  await touch(page, 'touchend', [])

  await expect(avatar(page)).not.toHaveAttribute('src', src ?? '')
  expect(await scaleOf(page)).toBe(1)
})
