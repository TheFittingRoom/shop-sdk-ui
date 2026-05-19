import { expect, test } from '@playwright/test'
import { bootSdk } from './helpers/boot'

// Proves the mock-overrides path works (driving a per-test API failure) and
// locks in "API failure does not crash the SDK" — the failure should be caught
// and logged, not propagated as an uncaught error to the host page.
test('500 on /v1/style-categories does not surface as a pageerror', async ({ page }) => {
  const pageErrors: Error[] = []
  page.on('pageerror', (err) => pageErrors.push(err))

  await bootSdk(page, {
    apiOverrides: {
      styleCategories: (route) => route.fulfill({ status: 500, json: { error: 'simulated server error' } }),
    },
  })

  await page.getByRole('button', { name: 'Fitting Room', exact: true }).click()

  // Give the SDK a beat to attempt + handle the rejected request.
  await page.waitForTimeout(500)

  expect(pageErrors, `Unexpected page errors:\n${pageErrors.map((e) => e.stack ?? e.message).join('\n---\n')}`).toEqual(
    [],
  )
})
