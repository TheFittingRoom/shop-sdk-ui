import { expect, test } from '@playwright/test'
import { bootSdk } from './helpers/boot'
import { TEST_BRAND_ID, TEST_PRODUCT_EXTERNAL_ID } from './fixtures/seed'

// Locks in the hanger-toggle UI state + the zustand store + the localStorage
// write under the `tfr:fitting-room:v1` key. If any link in that chain breaks,
// this test fails.
test('hanger toggle adds the current product to fitting-room storage', async ({ page }) => {
  await bootSdk(page)

  // Pre-click state: aria-label "Add to Fitting Room", aria-pressed="false"
  const button = page.getByRole('button', { name: 'Add to Fitting Room' })
  await expect(button).toHaveAttribute('aria-pressed', 'false')

  await button.click()

  // Post-click state: aria-label flips to "In Fitting Room", pressed=true.
  await expect(page.getByRole('button', { name: 'In Fitting Room' })).toHaveAttribute('aria-pressed', 'true')

  // localStorage roundtrip — entry must land under the brand-id key.
  const stored = await page.evaluate((brandId) => {
    const raw = window.localStorage.getItem('tfr:fitting-room:v1')
    return raw ? (JSON.parse(raw) as Record<string, { externalId: string }[]>)[String(brandId)] : null
  }, TEST_BRAND_ID)

  expect(stored).not.toBeNull()
  expect(stored?.length).toBe(1)
  expect(stored?.[0].externalId).toBe(TEST_PRODUCT_EXTERNAL_ID)
})
