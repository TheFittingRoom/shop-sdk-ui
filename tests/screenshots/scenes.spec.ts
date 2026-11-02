import { existsSync, mkdirSync, readFileSync, readdirSync } from 'fs'
import { join, resolve } from 'path'
import type { Page, Route } from '@playwright/test'
import { devices, expect, test } from '@playwright/test'
import type { FirestoreUser } from '../../src/api/gen/responses'
import { bootSdk } from '../e2e/helpers/boot'
import { bootFittingRoom, phoneViewport, PORTRAIT_FRAME, quickViewBoot } from '../e2e/helpers/try-on'
import { TEST_DEMO_USER_PROFILE, TEST_USER_PROFILE } from '../e2e/fixtures/seed'

// Screenshots of the signed-in try-on screens, for PRs and for checking a
// visual change by eye: `npm run screenshots` (README "Screenshots").
//
// It runs the e2e harness (host page, mocked Firebase and API) with real
// render frames in place of the 1x1 mock frame, at desktop and phone size,
// for a demo shopper and one with their own avatar. Nothing reaches a
// backend. This is not a test suite: nothing is asserted beyond the screen
// having loaded, and it is not part of `npm run test:e2e`.
//
// Environment:
//   SHOTS_DIR            where PNGs go (default: screenshots/, gitignored)
//   SHOTS_VTO_FRAMES     dir of image_N.* served as try-on (VTO) frames
//   SHOTS_AVATAR_FRAMES  dir of image_N.* served as bare-avatar frames
//   SHOTS_SHOPPERS       demo,own (default both)
// The frame dirs default to the local-deployment seed data the mock sim-vis
// renders from; real renders are scans of real people, so none are committed
// here. Without them every frame is a grey 2:3 placeholder.
// Filter scenes with Playwright's -g: `npm run screenshots -- -g "phone"`.

// Paths are relative to the repo root, where npm runs Playwright.
const LOCAL_DATA = resolve('../../local-data/s3-extracted/tfr-assets-dev')
const OUT = resolve(process.env.SHOTS_DIR ?? 'screenshots')
const VTO_FRAMES =
  process.env.SHOTS_VTO_FRAMES ??
  join(LOCAL_DATA, 'user-VNMR3nl3gdTCgt4KoeaNkUQerOs2/avatar-764/colorway-size-asset-4104/frames')
const AVATAR_FRAMES =
  process.env.SHOTS_AVATAR_FRAMES ?? join(LOCAL_DATA, 'user-0X4h0pBVAZbDRoxw7W7jQspNxg52/avatar-719/frames')
const SHOPPERS = (process.env.SHOTS_SHOPPERS ?? 'demo,own').split(',')

const CONTENT_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
}

// The frames in a directory, ordered by N in image_N.<ext>; empty if absent.
function loadFrames(dir: string): { body: Buffer; contentType: string }[] {
  if (!existsSync(dir)) {
    return []
  }
  return readdirSync(dir)
    .map((name) => ({ name, match: /^image_(\d+)(\.\w+)$/.exec(name) }))
    .filter((f) => f.match && CONTENT_TYPES[f.match[2].toLowerCase()])
    .sort((a, b) => Number(a.match?.[1]) - Number(b.match?.[1]))
    .map((f) => ({
      body: readFileSync(join(dir, f.name)),
      contentType: CONTENT_TYPES[(f.match?.[2] ?? '').toLowerCase()],
    }))
}
const vtoFrames = loadFrames(VTO_FRAMES)
const avatarFrames = loadFrames(AVATAR_FRAMES)

// Answers frame image_K with frame K of the matching set (wrapping round).
function frames(route: Route) {
  const url = route.request().url()
  const set = url.includes('/vto-') ? vtoFrames : avatarFrames
  const index = Number(/image_(\d+)\./.exec(url)?.[1] ?? 0)
  const frame = set[index % Math.max(set.length, 1)]
  return frame
    ? route.fulfill({ contentType: frame.contentType, body: frame.body })
    : route.fulfill({ contentType: 'image/svg+xml', body: PORTRAIT_FRAME })
}

const PROFILES: Record<string, FirestoreUser> = { demo: TEST_DEMO_USER_PROFILE, own: TEST_USER_PROFILE }

// Waits for every visible image to have loaded and the frame on show to have
// stopped changing (quick view auto-rotates when frames arrive), then saves.
async function shoot(page: Page, name: string) {
  await expect
    .poll(
      () =>
        page.evaluate(() =>
          [...document.querySelectorAll('img')]
            .filter((img) => img.getBoundingClientRect().width > 0)
            .every((img) => img.complete && img.naturalWidth > 0),
        ),
      { timeout: 10_000 },
    )
    .toBe(true)
  const shown = () => page.evaluate(() => [...document.querySelectorAll('img')].map((img) => img.src).join())
  let before = await shown()
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(400)
    const now = await shown()
    if (now === before) {
      break
    }
    before = now
  }
  mkdirSync(OUT, { recursive: true })
  await page.screenshot({ path: join(OUT, `${name}.png`) })
}

async function openQuickView(page: Page, profile: FirestoreUser) {
  const boot = quickViewBoot()
  await bootSdk(page, { profile, ...boot, apiOverrides: { ...boot.apiOverrides, frames } })
  await page.getByRole('button', { name: /quick view/i }).click()
}

async function openFittingRoomWithItem(page: Page, profile: FirestoreUser) {
  await bootFittingRoom(page, profile, frames)
  await page.getByRole('button', { name: /Test Product/i }).click()
}

for (const shopper of SHOPPERS) {
  const profile = PROFILES[shopper]
  if (!profile) {
    throw new Error(`SHOTS_SHOPPERS: unknown shopper "${shopper}" (demo, own)`)
  }

  test.describe(`desktop ${shopper}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 })
    })

    test(`desktop quick view (${shopper})`, async ({ page }) => {
      await openQuickView(page, profile)
      await shoot(page, `desktop-quick-view-${shopper}`)
    })

    test(`desktop fitting room, bare avatar (${shopper})`, async ({ page }) => {
      await bootFittingRoom(page, profile, frames)
      await shoot(page, `desktop-fitting-room-bare-${shopper}`)
    })

    test(`desktop fitting room and zoom (${shopper})`, async ({ page }) => {
      await openFittingRoomWithItem(page, profile)
      await shoot(page, `desktop-fitting-room-${shopper}`)
      await page.getByRole('button', { name: 'Zoom In' }).click()
      await shoot(page, `desktop-zoom-${shopper}`)
    })
  })

  test.describe(`phone ${shopper}`, () => {
    const { defaultBrowserType: _browser, ...pixel5 } = devices['Pixel 5']
    test.use(pixel5)
    test.beforeEach(async ({ page }) => {
      await phoneViewport(page)
    })

    test(`phone quick view (${shopper})`, async ({ page }) => {
      await openQuickView(page, profile)
      await shoot(page, `phone-quick-view-${shopper}`)
    })

    test(`phone fitting room browse and try-on (${shopper})`, async ({ page }) => {
      await openFittingRoomWithItem(page, profile)
      await shoot(page, `phone-fitting-room-browse-${shopper}`)
      await page.getByRole('button', { name: 'Try it on', exact: true }).click()
      await shoot(page, `phone-try-on-${shopper}`)
    })
  })
}
