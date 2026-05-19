import { expect, test } from '@playwright/test'
import { bootSdk } from './helpers/boot'
import { TEST_ID_TOKEN } from './fixtures/seed'

// Locks in three things at once: the widget click path, REST mocking against
// the real API base URL, and the auth-bearer wiring from MockAuthManager
// through getAuthToken() into the api.ts request layer.
test('clicking the fitting-room icon opens the overlay and fires /v1/style-categories with the auth bearer', async ({
  page,
}) => {
  await bootSdk(page)

  // Wait for the request, then click. waitForRequest is set up first so the
  // listener is attached before the click can race past it.
  const stylesReq = page.waitForRequest((req) => req.url().endsWith('/v1/style-categories'), { timeout: 10_000 })

  // The fitting-room icon widget renders a <button aria-label="Fitting Room">
  // (locale key `view_fitting_room`). `exact: true` disambiguates from the
  // hanger toggle ("Add to Fitting Room" / "In Fitting Room").
  await page.getByRole('button', { name: 'Fitting Room', exact: true }).click()

  const req = await stylesReq
  expect(req.headers()['authorization']).toBe(`Bearer ${TEST_ID_TOKEN}`)
})
