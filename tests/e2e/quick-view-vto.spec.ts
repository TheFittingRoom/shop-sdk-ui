import { expect, test } from '@playwright/test'
import { bootSdk } from './helpers/boot'
import { TEST_SEEDED_STYLE, TEST_SIZE_FIT_RECOMMENDATION, TEST_VTO_COMPOSITION_12 } from './fixtures/seed'

// End-to-end coverage for the quick-view VTO flow: style resolved from
// firestore → /v1/styles/{id}/recommendation → /v1/vto-compositions →
// AvatarFrameViewer renders → useAutoRotate plays.
//
// The auto-rotate behaviour broke twice during a single session (stops-after-
// 1-frame from React 18's deferred-updater batching; stops-after-N from
// prefetch landings tearing down the effect). Both tests below directly
// regression-protect those failure modes; the user-cancel test additionally
// locks in the onUserInteract → cancelAutoRotate wiring.

const RICH_BOOT = {
  apiOverrides: {
    sizeRecommendation: (route: { fulfill: (r: { json: unknown }) => Promise<void> }) =>
      route.fulfill({ json: TEST_SIZE_FIT_RECOMMENDATION }),
    vtoComposition: (route: { fulfill: (r: { json: unknown }) => Promise<void> }) =>
      route.fulfill({ json: TEST_VTO_COMPOSITION_12 }),
  },
  firestoreDocs: { styles: { 'style-1': TEST_SEEDED_STYLE } },
}

// Pulls the integer N out of an image_N.png frame URL. Lets tests assert on
// "the displayed frame index" without coupling to the rest of the URL shape.
function frameIndexFromSrc(src: string | null): number | null {
  const m = src?.match(/image_(\d+)\.png/)
  return m ? Number(m[1]) : null
}

test('quick-view: VTO frames load and auto-rotate advances through them', async ({ page }) => {
  await bootSdk(page, RICH_BOOT)
  await page.getByRole('button', { name: /quick view/i }).click()

  const avatar = page.locator('img[src*="image_"]')

  // Frame 0 should land first — produced by the default-to-0 effect in
  // AvatarFrameViewer the moment frameUrls arrives.
  await expect(avatar).toHaveAttribute('src', /image_0\.png/, { timeout: 5000 })

  // useAutoRotate ticks every 500ms, so within ~3s we should be well past
  // frame 0. Asserting "advanced to >= 3" (rather than a specific index)
  // tolerates timer jitter without weakening the bug coverage — the regressed
  // versions stopped at 0 or 1.
  await expect
    .poll(async () => frameIndexFromSrc(await avatar.getAttribute('src')), { timeout: 3000 })
    .toBeGreaterThanOrEqual(3)
})

test('quick-view: chevron click cancels the auto-rotate', async ({ page }) => {
  await bootSdk(page, RICH_BOOT)
  await page.getByRole('button', { name: /quick view/i }).click()

  const avatar = page.locator('img[src*="image_"]')
  await expect(avatar).toHaveAttribute('src', /image_0\.png/, { timeout: 5000 })

  // Click the right chevron once. rotateRight advances frame 0 → 1 AND fires
  // onUserInteract → cancelAutoRotate. If the cancellation breaks, the
  // auto-rotate will keep ticking and march past frame 1 within ~2s.
  await page.getByRole('button', { name: 'Rotate right', exact: true }).click()
  await expect(avatar).toHaveAttribute('src', /image_1\.png/, { timeout: 1000 })

  // Hold for 2s — at 500ms/tick the rotation would reach frame 5 if it weren't
  // cancelled. Anything past frame 1 means the cancel wiring is broken.
  await page.waitForTimeout(2000)
  const finalIndex = frameIndexFromSrc(await avatar.getAttribute('src'))
  expect(finalIndex).toBe(1)
})
