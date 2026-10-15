import { expect, test } from '@playwright/test'
import { bootSdk } from './helpers/boot'
import { TEST_ID_TOKEN } from './fixtures/seed'

// Locks in three things at once: the widget click path, REST mocking against
// the real API base URL, and the auth-bearer wiring from MockAuthManager
// through getAuthToken() into the api.ts request layer.
test('clicking the fitting-room icon opens the overlay and fires /v1/style-categories with the auth bearer', async ({
  page,
}) => {
  // The categories load with the page for a shopper with an avatar, so the
  // listener is attached before boot.
  const stylesReq = page.waitForRequest((req) => req.url().endsWith('/v1/style-categories'), { timeout: 10_000 })

  await bootSdk(page)

  // The fitting-room icon widget renders a <button aria-label="Fitting Room">
  // (locale key `view_fitting_room`). `exact: true` disambiguates from the
  // hanger toggle ("Add to Fitting Room" / "In Fitting Room").
  await page.getByRole('button', { name: 'Fitting Room', exact: true }).click()

  // The categories load at boot, so the request alone does not show that the
  // click did anything. "Shop now" is the empty fitting room's button; a bare
  // dialog match would also find the first-visit tooltip.
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Shop now' })).toBeVisible()

  const req = await stylesReq
  expect(req.headers()['authorization']).toBe(`Bearer ${TEST_ID_TOKEN}`)
})
