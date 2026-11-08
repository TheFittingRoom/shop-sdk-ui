#!/usr/bin/env node
// Screenshots of this branch's SDK running on the real demo storefront, at
// desktop and phone size — the store's fonts, layout and CSS, which the e2e
// host page (tests/e2e/fixtures/host.html) doesn't have.
//
//   npm run build
//   node scripts/storefront-screenshots.cjs <out-dir> [product-handle] \
//     [--asset <name>=<local-file> ...] [--storage-state <file> [--allow-renders]]
//
// --asset answers requests for an SDK asset (config.asset.baseUrl/<name>,
// e.g. intro-video-poster.jpg) with a local file, to preview new images or
// video on the store before uploading them to the assets bucket.
//
// How: the store loads the published SDK from unpkg. The browser here answers
// that request with dist/index.js instead, so the theme runs the local build
// exactly as it would run a release (against the dev backend, the theme's
// default). This is deliberately not `?tfr-source=local-dev`: Chrome's local
// network access rules stop a public site loading from localhost unless the
// user has allowed it, and a fresh headless browser hasn't.
//
// Signed out by default: the landing, sign-up and sign-in screens.
//
// --storage-state <file> runs signed in instead, as the account saved in a
// Playwright storage state (local-deployment's `scripts/login.sh <account>`
// writes one per test account, in local-data/sessions/). Signed in, opening
// the try-on can start a real render on dev, which costs sim-vis time, so VTO
// requests are blocked unless --allow-renders is given.
const fs = require('fs')
const path = require('path')
const { chromium, devices } = require('@playwright/test')

const STORE = 'https://tfrshop-1346.myshopify.com'
const positional = []
const assets = {}
let storageState
let allowRenders = false
const argv = process.argv.slice(2)
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--storage-state') {
    storageState = argv[++i]
    if (!storageState || !fs.existsSync(storageState)) {
      console.error(`--storage-state needs an existing file, got ${storageState}`)
      process.exit(2)
    }
  } else if (argv[i] === '--allow-renders') {
    allowRenders = true
  } else if (argv[i] === '--asset') {
    const [name, file] = (argv[++i] ?? '').split('=')
    if (!name || !file || !fs.existsSync(file)) {
      console.error(`--asset needs <name>=<existing-file>, got ${argv[i]}`)
      process.exit(2)
    }
    assets[name] = fs.readFileSync(file)
  } else {
    positional.push(argv[i])
  }
}
const [outDir, handle = 'camisole-vest'] = positional
if (!outDir) {
  console.error(
    'usage: node scripts/storefront-screenshots.cjs <out-dir> [product-handle] [--asset <name>=<local-file> ...] [--storage-state <file> [--allow-renders]]',
  )
  process.exit(2)
}
const CONTENT_TYPES = { '.jpg': 'image/jpeg', '.png': 'image/png', '.mp4': 'video/mp4', '.svg': 'image/svg+xml' }
const bundlePath = path.join(__dirname, '..', 'dist', 'index.js')
if (!fs.existsSync(bundlePath)) {
  console.error('no dist/index.js: run `npm run build` first')
  process.exit(2)
}
const BUNDLE = fs.readFileSync(bundlePath)
fs.mkdirSync(outDir, { recursive: true })

// Installed Google Chrome when there is one: Playwright's bundled Chromium
// can't decode H.264, so videos wouldn't play in it.
async function launch() {
  try {
    return await chromium.launch({ channel: 'chrome' })
  } catch {
    return await chromium.launch()
  }
}

async function capture(name, contextOptions) {
  const browser = await launch()
  try {
    const context = await browser.newContext({ ...contextOptions, storageState })
    if (storageState && !allowRenders) {
      // The try-on then shows "Couldn't load the try-on": that's this block.
      await context.route(/\/v1\/vto-compositions/, (route) => {
        if (route.request().method() !== 'POST') return route.continue()
        console.log(`[${name}] blocked a VTO render request (pass --allow-renders to allow)`)
        return route.abort()
      })
    }
    await context.route(/unpkg\.com\/@thefittingroom\/shop-ui/, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: BUNDLE,
        headers: { 'access-control-allow-origin': '*' },
      }),
    )
    for (const [asset, body] of Object.entries(assets)) {
      await context.route(new RegExp(`/shop-sdk/assets/v5/${asset.replace(/[.]/g, '\\.')}$`), (route) =>
        route.fulfill({
          status: 200,
          contentType: CONTENT_TYPES[path.extname(asset)] ?? 'application/octet-stream',
          body,
        }),
      )
    }
    const page = await context.newPage()
    page.on('console', (m) => {
      if (m.type() === 'error') {
        console.log(`[${name}] console error: ${m.text().slice(0, 200)}`)
      }
    })
    const shot = async (step) => {
      await page.waitForTimeout(800)
      const file = path.join(outDir, `${name}-${step}.png`)
      await page.screenshot({ path: file })
      console.log(file)
    }

    // Signed in, the SDK keeps a Firestore listener open, so the page never
    // goes network-idle; the quick-view wait below covers readiness.
    await page.goto(`${STORE}/products/${handle}`, { waitUntil: storageState ? 'load' : 'networkidle' })
    const quickView = page.getByRole('button', { name: /quick view/i }).first()
    await quickView.waitFor({ timeout: 20000 })
    await shot('0-pdp')
    if (storageState) {
      await quickView.click()
      await page.waitForTimeout(6000)
      await shot('1-signed-in')
      if (await page.getByRole('button', { name: 'Try it now, scan later' }).isVisible()) {
        console.error(
          `[${name}] still signed out: the session in ${storageState} didn't work; ` +
            'ask a person to run local-deployment `scripts/login.sh <account>` again',
        )
        process.exitCode = 1
      }
      return
    }
    await quickView.click()
    await page.getByRole('button', { name: 'Try it now, scan later' }).waitFor({ timeout: 15000 })
    await shot('1-landing')
    // The intro video, a couple of seconds in.
    await page.getByRole('button', { name: 'Play the video' }).click()
    await page.waitForTimeout(2200)
    await shot('1b-landing-video')
    await page.getByRole('dialog').getByRole('button', { name: 'Close modal' }).click()
    await page
      .getByRole('button', { name: /quick view/i })
      .first()
      .click()
    await page.getByRole('button', { name: 'Try it now, scan later' }).waitFor({ timeout: 15000 })
    await page.getByRole('button', { name: 'Try it now, scan later' }).click()
    await shot('2-sign-up')
    await page.getByRole('button', { name: 'Create account' }).click()
    await shot('3-sign-up-errors')
    // With every field in error the form outgrows a phone screen; the modal
    // must scroll to its button rather than clip it.
    await page.getByRole('button', { name: 'Create account' }).scrollIntoViewIfNeeded()
    await shot('3b-sign-up-errors-scrolled')
    await page.getByText('Sign in.').click()
    await shot('4-sign-in')
  } finally {
    await browser.close()
  }
}

;(async () => {
  await capture('desktop', { viewport: { width: 1440, height: 900 } })
  const { defaultBrowserType: _browser, ...pixel5 } = devices['Pixel 5']
  await capture('mobile', pixel5)
})().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
