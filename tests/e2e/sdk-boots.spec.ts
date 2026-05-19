import { expect, test } from '@playwright/test'
import { bootSdk } from './helpers/boot'

// Boot smoke test: proves the whole pipeline — build → serve → host fixture →
// SDK init({ testHooks }) → custom element registration — works end to end.
test('SDK boots in mock mode and registers the <tfr-widget> custom element', async ({ page }) => {
  await bootSdk(page)

  // init() resolved truthy (the bootSdk helper waits for the event, but assert
  // it explicitly here so the failure message points at the right thing).
  const initOk = await page.evaluate(
    () => (window as unknown as { __TFR_TEST_INIT_OK__?: boolean }).__TFR_TEST_INIT_OK__,
  )
  expect(initOk).toBe(true)

  const widgetDefined = await page.evaluate(() => customElements.get('tfr-widget') !== undefined)
  expect(widgetDefined).toBe(true)
})
