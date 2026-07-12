import { expect, test } from '@playwright/test'
import { bootSdk } from './helpers/boot'
import {
  TEST_CONTAINER_CHILD_PANTS_CSA_ID,
  TEST_CONTAINER_CHILD_SHIRT_CSA_ID,
  TEST_CONTAINER_CURRENT_PRODUCT,
  TEST_CONTAINER_PARENT_CSA_ID,
  TEST_CONTAINER_SEEDED_STYLE,
  TEST_CONTAINER_SIZE_FIT_RECOMMENDATION,
  TEST_VTO_COMPOSITION_12,
} from './fixtures/seed'

// End-to-end coverage for container (Suits & Sets) VTO expansion. Wire
// contract for /v1/vto-compositions is unchanged (1..4 leaf-garment items);
// containers require the SDK to fan out the shopper's one parent-CSA
// selection into N leaf-CSA items[] entries before posting. This test
// intercepts the composition POST body and asserts on the wire shape.
//
// The critical bug this guards against: SDK regresses to posting the parent
// CSA id (backend rejects it — parents have no .usdz), or the resolver walks
// the wrong colorway and posts stale/missing child ids.

test('quick-view container: POST /v1/vto-compositions carries child CSAs, not the parent CSA', async ({ page }) => {
  const capturedRequests: Array<{ colorway_size_asset_id: number; untucked?: boolean }[]> = []

  await bootSdk(page, {
    currentProduct: TEST_CONTAINER_CURRENT_PRODUCT,
    apiOverrides: {
      sizeRecommendation: (route) => route.fulfill({ json: TEST_CONTAINER_SIZE_FIT_RECOMMENDATION }),
      vtoComposition: async (route) => {
        // Capture the wire shape sent by the SDK, then fulfill with the
        // standard 12-frame VTO response so the UI has something to render.
        const body = route.request().postDataJSON() as { items: (typeof capturedRequests)[number] }
        capturedRequests.push(body.items)
        await route.fulfill({ json: TEST_VTO_COMPOSITION_12 })
      },
    },
    firestoreDocs: { styles: { 'container-style-1': TEST_CONTAINER_SEEDED_STYLE } },
  })
  await page.getByRole('button', { name: /quick view/i }).click()

  // Wait for the composition POST to fire.
  await expect.poll(() => capturedRequests.length, { timeout: 5000 }).toBeGreaterThanOrEqual(1)

  const items = capturedRequests[0]
  expect(items).toHaveLength(2)
  const emittedCsaIds = items.map((i) => i.colorway_size_asset_id).sort((a, b) => a - b)
  expect(emittedCsaIds).toEqual(
    [TEST_CONTAINER_CHILD_SHIRT_CSA_ID, TEST_CONTAINER_CHILD_PANTS_CSA_ID].sort((a, b) => a - b),
  )

  // Explicitly assert the parent CSA is NOT in the wire request — if it
  // ever appears, the resolver has regressed to no-op / bypass.
  expect(emittedCsaIds).not.toContain(TEST_CONTAINER_PARENT_CSA_ID)
})
