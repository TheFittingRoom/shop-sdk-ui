import { expect, test } from '@playwright/test'
import { bootSdk } from './helpers/boot'
import { TEST_BRAND_ID, TEST_PRODUCT_EXTERNAL_ID, TEST_UID } from './fixtures/seed'

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

  // localStorage roundtrip — entry must land under the (brandId, userId)
  // bucket. bootSdk defaults to loggedIn=true with TEST_UID, so the
  // shopper's UID scopes the bucket; anonymous browsing would land at
  // buckets["__anonymous__"] instead.
  const stored = await page.evaluate(
    ({ brandId, userId }) => {
      const raw = window.localStorage.getItem('tfr:fitting-room:v1')
      if (!raw) {
        return null
      }
      const parsed = JSON.parse(raw) as Record<string, Record<string, { externalId: string }[]>>
      return parsed[String(brandId)]?.[userId] ?? null
    },
    { brandId: TEST_BRAND_ID, userId: TEST_UID },
  )

  expect(stored).not.toBeNull()
  expect(stored?.length).toBe(1)
  expect(stored?.[0].externalId).toBe(TEST_PRODUCT_EXTERNAL_ID)
})
