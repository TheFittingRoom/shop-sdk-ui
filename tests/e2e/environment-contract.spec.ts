import { expect, test, type ConsoleMessage } from '@playwright/test'
import { EnvName, getConfig } from '../../src/lib/config'
import { TEST_BRAND_ID, TEST_CURRENT_PRODUCT } from './fixtures/seed'

// Each backend host verifies Firebase ID tokens against exactly one project.
// An SDK signed in to any other project gets 401 on every authenticated
// request, so the (API host, Firebase project, asset bucket) tuple is a
// contract, not a preference. Every host in service today is backed by the
// dev project and reads from the dev bucket; add a row when a backend changes.
const SUPPORTED: Record<string, { firebaseProject: string; assetBucket: string }> = {
  'tfr.dev.thefittingroom.xyz': { firebaseProject: 'fittingroom-dev-5d248', assetBucket: 'tfr-assets-dev' },
  'tfr-synteq.thefittingroom.xyz': { firebaseProject: 'fittingroom-dev-5d248', assetBucket: 'tfr-assets-dev' },
  'demo.thefittingroom.xyz': { firebaseProject: 'fittingroom-dev-5d248', assetBucket: 'tfr-assets-dev' },
  'localhost:8080': { firebaseProject: 'fittingroom-dev-5d248', assetBucket: 'tfr-assets-dev' },
}

// Profiles that refuse to initialise because no backend verifies tokens for
// them yet. Removing one from here puts it under the SUPPORTED table.
const UNAVAILABLE: EnvName[] = [EnvName.PRODUCTION]

for (const env of Object.values(EnvName)) {
  if (UNAVAILABLE.includes(env)) {
    test(`${env} has no backend yet and is rejected by getConfig`, () => {
      expect(() => getConfig(env)).toThrow('not available yet')
    })
    continue
  }

  test(`${env} pairs its API host with the Firebase project that backs it`, () => {
    const config = getConfig(env)
    const host = new URL(config.api.baseUrl).host
    expect(Object.keys(SUPPORTED), `${host} is not a supported backend`).toContain(host)

    const { firebaseProject, assetBucket } = SUPPORTED[host]
    expect(config.firebase.projectId).toBe(firebaseProject)
    expect(config.firebase.authDomain).toBe(`${firebaseProject}.firebaseapp.com`)
    expect(config.firebase.storageBucket).toBe(`${firebaseProject}.appspot.com`)
    expect(new URL(config.asset.baseUrl).pathname).toMatch(new RegExp(`/${assetBucket}/shop-sdk/assets/v5$`))
    expect(new URL(config.frames.baseUrl).pathname).toMatch(new RegExp(`/${assetBucket}$`))
  })
}

// The SDK logs failures as console.error(message, { error }); the Error inside
// the data object only comes through by evaluating the argument handle.
async function loggedErrorText(msg: ConsoleMessage): Promise<string> {
  const parts = await Promise.all(
    msg.args().map((arg) =>
      arg.evaluate((value) => {
        const nested = (value as { error?: unknown } | null)?.error
        const err = value instanceof Error ? value : nested
        return err instanceof Error ? err.message : String(value)
      }),
    ),
  )
  return parts.join(' ')
}

test('init with environment "production" fails instead of signing in to the wrong project', async ({ page }) => {
  const logged: Promise<string>[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      logged.push(loggedErrorText(msg))
    }
  })

  await page.addInitScript(
    ({ brandId, currentProduct }) => {
      ;(window as unknown as { __TFR_TEST_CONFIG__: unknown }).__TFR_TEST_CONFIG__ = {
        brandId,
        currentProduct,
        environment: 'production',
        // Keeps Firebase mocked should init ever get past config lookup.
        testHooks: { firestore: { docs: {} } },
      }
    },
    { brandId: TEST_BRAND_ID, currentProduct: TEST_CURRENT_PRODUCT },
  )
  await page.goto('/tests/e2e/fixtures/host.html')

  await page.waitForFunction(
    () => {
      const w = window as unknown as { __TFR_TEST_INIT_OK__?: boolean; __TFR_TEST_INIT_ERROR__?: string }
      return w.__TFR_TEST_INIT_OK__ !== undefined || w.__TFR_TEST_INIT_ERROR__ !== undefined
    },
    undefined,
    { timeout: 10_000 },
  )

  const initOk = await page.evaluate(
    () => (window as unknown as { __TFR_TEST_INIT_OK__?: boolean }).__TFR_TEST_INIT_OK__,
  )
  expect(initOk).toBe(false)
  expect((await Promise.all(logged)).join('\n')).toContain('"production" is not available yet')
})
