import type { Page, Route } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { bootSdk } from './helpers/boot'
import {
  TEST_BRAND_ID,
  TEST_ID_TOKEN,
  TEST_PRODUCT_EXTERNAL_ID,
  TEST_PRODUCT_HANDLE,
  TEST_SEEDED_STYLE,
  TEST_UID,
  TEST_USER_PROFILE,
} from './fixtures/seed'

// Scheduling of the speculative VTO prefetches behind the selected outfit,
// driven mostly through quick-view: the selection is posted at once,
// alternates wait until its response has settled plus
// config.api.vtoPrefetchDelayMs, and run one at a time.
//
// Renders on the backend take 5 to 9 s uncached. The fake backend below holds
// a composition's response until the test releases it, which is how these
// tests make a render slow.

// config.api.vtoPrefetchDelayMs for the demo environment the harness boots.
const PREFETCH_DELAY_MS = 3000
// Past the delay, so a prefetch timed from the selection would already be out.
const SLOW_RENDER_MS = PREFETCH_DELAY_MS + 1500

const SIZES = ['S', 'M', 'L'] as const
const COLORS = ['Blue', 'Red'] as const
type SizeLabel = (typeof SIZES)[number]
type ColorLabel = (typeof COLORS)[number]

function csaId(size: SizeLabel, color: ColorLabel): number {
  return 5000 + (COLORS.indexOf(color) + 1) * 100 + SIZES.indexOf(size) + 1
}

function sku(size: SizeLabel, color: ColorLabel): string {
  return `SKU-${size}-${color.toUpperCase()}`
}

// A single-item composition is identified by its CSA id.
const S_BLUE = String(csaId('S', 'Blue'))
const M_BLUE = String(csaId('M', 'Blue'))
const L_BLUE = String(csaId('L', 'Blue'))
const S_RED = String(csaId('S', 'Red'))
const M_RED = String(csaId('M', 'Red'))
const L_RED = String(csaId('L', 'Red'))

const PRODUCT = {
  productName: 'Prefetch Product',
  productDescriptionHtml: '<p>Three sizes, two colors</p>',
  externalId: TEST_PRODUCT_EXTERNAL_ID,
  handle: TEST_PRODUCT_HANDLE,
  imageUrl: null,
  variants: SIZES.flatMap((size) =>
    COLORS.map((color) => ({
      sku: sku(size, color),
      size,
      color,
      fullName: `Prefetch ${size} ${color}`,
      skuName: sku(size, color),
      priceFormatted: '$50.00',
      imageUrl: null,
    })),
  ),
}

function sizeRow(size: SizeLabel) {
  return {
    id: 300 + SIZES.indexOf(size),
    label: size,
    size_value: { value: size },
    colorway_size_assets: COLORS.map((color) => ({
      id: csaId(size, color),
      sku: sku(size, color),
      // The fitting room's alternates keep the selected colorway.
      colorway_id: 40 + COLORS.indexOf(color),
    })),
  }
}

// M is recommended, so quick-view opens on M in the PDP's color (Blue).
const SIZE_RECOMMENDATION = {
  fit_classification: 'regular_fit',
  recommended_size: sizeRow('M'),
  available_sizes: SIZES.map(sizeRow),
  fits: SIZES.map((size) => ({ size_id: sizeRow(size).id, measurement_location_fits: [] })),
}

const SECOND_ACCOUNT = {
  uid: 'test-uid-2',
  email: 'second@example.com',
  idToken: 'mock-id-token-def456',
  profile: {
    ...TEST_USER_PROFILE,
    full_name: 'Second Shopper',
    avatar_frames: ['user-test-2/avatar-7/frames/image_0.png', 'user-test-2/avatar-7/frames/image_1.png'],
  },
}

interface VtoPost {
  composition: string
  user: 'a' | 'b'
}

// Stands in for POST /v1/vto-compositions. Every request is recorded. A held
// composition stays pending until release(); a failing one answers 500.
class FakeVtoBackend {
  readonly posts: VtoPost[] = []
  private readonly held = new Set<string>()
  private readonly failing = new Set<string>()
  private readonly pending = new Map<string, (() => Promise<void>)[]>()

  hold(...compositions: string[]) {
    compositions.forEach((c) => this.held.add(c))
  }

  fail(...compositions: string[]) {
    compositions.forEach((c) => this.failing.add(c))
  }

  async release(composition: string) {
    this.held.delete(composition)
    const waiting = this.pending.get(composition) ?? []
    this.pending.delete(composition)
    await Promise.all(waiting.map((respond) => respond()))
  }

  compositions(): string[] {
    return this.posts.map((p) => p.composition)
  }

  count(composition: string): number {
    return this.posts.filter((p) => p.composition === composition).length
  }

  readonly route = async (route: Route) => {
    const request = route.request()
    const body = request.postDataJSON() as { items: { colorway_size_asset_id: number }[] }
    const composition = body.items
      .map((i) => i.colorway_size_asset_id)
      .sort((a, b) => a - b)
      .join('+')
    const user = request.headers()['authorization'] === `Bearer ${TEST_ID_TOKEN}` ? 'a' : 'b'
    this.posts.push({ composition, user })
    // Frame paths carry the composition and the user, so the test can tell
    // from the <img> which response is on screen.
    const respond = () =>
      this.failing.has(composition)
        ? route.fulfill({ status: 500, json: { error: 'render failed' } })
        : route.fulfill({
            json: {
              token: `tok-${composition}`,
              frames: [0, 1].map((i) => `user-${user}/avatar-1/vto-${composition}/frames/image_${i}.png`),
            },
          })
    if (this.held.has(composition)) {
      this.pending.set(composition, [...(this.pending.get(composition) ?? []), respond])
      return
    }
    await respond()
  }
}

async function openQuickView(page: Page, backend: FakeVtoBackend, accounts?: (typeof SECOND_ACCOUNT)[]) {
  await bootSdk(page, {
    currentProduct: PRODUCT,
    firestoreDocs: { styles: { 'style-1': TEST_SEEDED_STYLE } },
    apiOverrides: {
      sizeRecommendation: (route) => route.fulfill({ json: SIZE_RECOMMENDATION }),
      vtoComposition: backend.route,
    },
    accounts,
  })
  await page.getByRole('button', { name: /quick view/i }).click()
}

// Fitting-room wiring for PRODUCT ('tshirt'), stored as a fitting-room item
// that is not yet selected.
const TSHIRT_CATEGORY = {
  name: 'tshirt',
  label: 'T-Shirts',
  label_singular: 'T-Shirt',
  group: 'tops',
  layer_order: 10,
  tuckable: false,
  layer_order_untucked: 10,
  sleeve_selection: 'not_applicable',
  measurement_locations: [],
  additional_locations_full_sleeves: [],
  includes: [],
  excludes: [],
  is_container: false,
}
const TOPS_GROUP = { name: 'tops', label: 'Tops', same_group_default: 'exclude', display_order: 1 }

async function openFittingRoom(page: Page, backend: FakeVtoBackend) {
  await page.addInitScript(
    ({ brandId, uid, externalId, handle }) => {
      const item = { externalId, handle, size: 'M', color: 'Blue', colorwaySizeAssetId: null, addedAt: 1 }
      window.localStorage.setItem('tfr:fitting-room:v1', JSON.stringify({ [String(brandId)]: { [uid]: [item] } }))
    },
    { brandId: TEST_BRAND_ID, uid: TEST_UID, externalId: TEST_PRODUCT_EXTERNAL_ID, handle: TEST_PRODUCT_HANDLE },
  )
  await bootSdk(page, {
    currentProduct: PRODUCT,
    firestoreDocs: { styles: { 'style-1': TEST_SEEDED_STYLE } },
    apiOverrides: {
      sizeRecommendation: (route) => route.fulfill({ json: SIZE_RECOMMENDATION }),
      styleCategories: (route) => route.fulfill({ json: [TSHIRT_CATEGORY] }),
      styleCategoryGroups: (route) => route.fulfill({ json: [TOPS_GROUP] }),
      vtoComposition: backend.route,
    },
  })
  await page.getByRole('button', { name: 'Fitting Room', exact: true }).click()
}

async function shownSrc(page: Page): Promise<string | null> {
  const avatar = page.locator('img[src*="/vto-"]')
  return (await avatar.count()) > 0 ? avatar.first().getAttribute('src') : null
}

async function shownComposition(page: Page): Promise<string | null> {
  return (await shownSrc(page))?.match(/\/vto-([^/]+)\//)?.[1] ?? null
}

function sizeButton(page: Page, size: SizeLabel) {
  return page.getByRole('dialog').getByRole('button', { name: size, exact: true })
}

function colorSelect(page: Page) {
  return page.getByRole('dialog').locator('select')
}

const VTO_ERROR = /load the try-on/

test('a slow selected render holds every prefetch until it resolves, then they run one at a time', async ({ page }) => {
  const backend = new FakeVtoBackend()
  backend.hold(M_BLUE, S_BLUE, L_BLUE)
  await openQuickView(page, backend)

  await expect.poll(() => backend.compositions()).toEqual([M_BLUE])
  await page.waitForTimeout(SLOW_RENDER_MS)
  expect(backend.compositions(), 'no prefetch may go out while the selection renders').toEqual([M_BLUE])

  await backend.release(M_BLUE)
  // The delay runs from the selected response, not from the selection.
  await page.waitForTimeout(PREFETCH_DELAY_MS - 1000)
  expect(await shownComposition(page)).toBe(M_BLUE)
  expect(backend.compositions()).toEqual([M_BLUE])

  await expect.poll(() => backend.posts.length, { timeout: 5000 }).toBe(2)
  const first = backend.posts[1].composition
  const second = first === S_BLUE ? L_BLUE : S_BLUE
  expect([S_BLUE, L_BLUE]).toContain(first)
  await page.waitForTimeout(1000)
  expect(backend.posts.length, 'the second prefetch waits for the first').toBe(2)

  await backend.release(first)
  await expect.poll(() => backend.compositions()).toEqual([M_BLUE, first, second])
  await backend.release(second)
})

test('a cached selection releases the prefetches without posting it again', async ({ page }) => {
  const backend = new FakeVtoBackend()
  backend.hold(M_BLUE, M_RED)
  await openQuickView(page, backend)
  await expect.poll(() => backend.compositions()).toEqual([M_BLUE])

  // Move on while Blue renders, so Blue's alternates are dropped.
  await colorSelect(page).selectOption('Red')
  await expect.poll(() => backend.compositions()).toEqual([M_BLUE, M_RED])
  // Blue lands after the shopper has moved on: kept, but not shown.
  await backend.release(M_BLUE)
  await page.waitForTimeout(500)
  expect(await shownComposition(page)).toBeNull()

  // Back to Blue, already rendered. Red is still pending but no longer gates
  // anything: Blue's alternates go out after the delay.
  await colorSelect(page).selectOption('Blue')
  await expect.poll(() => shownComposition(page)).toBe(M_BLUE)
  await expect.poll(() => backend.posts.length, { timeout: PREFETCH_DELAY_MS + 3000 }).toBe(4)
  expect(backend.compositions().slice(2).sort()).toEqual([L_BLUE, S_BLUE].sort())

  // The stale Red response lands without taking over the screen.
  await backend.release(M_RED)
  await page.waitForTimeout(1000)
  expect(await shownComposition(page)).toBe(M_BLUE)
  expect(backend.count(M_BLUE)).toBe(1)
  expect(backend.count(S_RED) + backend.count(L_RED), 'alternates of a dropped selection').toBe(0)
})

test('a failed selection still releases the prefetches and is not posted again', async ({ page }) => {
  const backend = new FakeVtoBackend()
  backend.fail(M_BLUE, S_BLUE)
  await openQuickView(page, backend)

  await expect(page.getByText(VTO_ERROR)).toBeVisible()
  await page.getByRole('button', { name: 'Dismiss' }).click()

  await expect.poll(() => backend.posts.length, { timeout: PREFETCH_DELAY_MS + 3000 }).toBe(3)
  expect(backend.compositions().slice(1).sort()).toEqual([L_BLUE, S_BLUE].sort())

  await page.waitForTimeout(1500)
  // S failed as a prefetch: nobody was looking at it.
  await expect(page.getByText(VTO_ERROR)).toHaveCount(0)
  expect(backend.count(M_BLUE)).toBe(1)
  expect(backend.count(S_BLUE)).toBe(1)
})

test('rapid size changes post each pick at once and stale responses never replace the current one', async ({
  page,
}) => {
  const backend = new FakeVtoBackend()
  backend.hold(M_BLUE, S_BLUE, L_BLUE)
  await openQuickView(page, backend)
  await expect.poll(() => backend.compositions()).toEqual([M_BLUE])

  await sizeButton(page, 'S').click()
  await sizeButton(page, 'L').click()
  await expect.poll(() => backend.compositions()).toEqual([M_BLUE, S_BLUE, L_BLUE])

  await backend.release(S_BLUE)
  await backend.release(M_BLUE)
  await page.waitForTimeout(500)
  expect(await shownComposition(page), 'L is selected and still rendering').toBeNull()

  await backend.release(L_BLUE)
  await expect.poll(() => shownComposition(page)).toBe(L_BLUE)

  await page.waitForTimeout(PREFETCH_DELAY_MS + 1000)
  expect(await shownComposition(page)).toBe(L_BLUE)
  expect(backend.compositions()).toEqual([M_BLUE, S_BLUE, L_BLUE])
})

test('repeated requests for the same composition post it once', async ({ page }) => {
  const backend = new FakeVtoBackend()
  await openQuickView(page, backend)
  // M, then its two alternates. The prefetch loop also asks for M itself.
  await expect.poll(() => backend.posts.length, { timeout: PREFETCH_DELAY_MS + 4000 }).toBe(3)

  for (const [size, composition] of [
    ['S', S_BLUE],
    ['L', L_BLUE],
    ['M', M_BLUE],
    ['S', S_BLUE],
  ] as const) {
    await sizeButton(page, size).click()
    await expect.poll(() => shownComposition(page)).toBe(composition)
  }

  await page.waitForTimeout(PREFETCH_DELAY_MS + 1000)
  expect(backend.compositions().sort()).toEqual([L_BLUE, M_BLUE, S_BLUE].sort())
})

test('selecting a prefetch that is still in flight joins it instead of posting again', async ({ page }) => {
  const backend = new FakeVtoBackend()
  backend.hold(S_BLUE, L_BLUE)
  await openQuickView(page, backend)
  await expect.poll(() => backend.posts.length, { timeout: PREFETCH_DELAY_MS + 3000 }).toBe(2)

  const inFlight = backend.posts[1].composition
  const other = inFlight === S_BLUE ? L_BLUE : S_BLUE
  await sizeButton(page, inFlight === S_BLUE ? 'S' : 'L').click()
  await page.waitForTimeout(500)
  expect(backend.count(inFlight)).toBe(1)

  await backend.release(inFlight)
  await expect.poll(() => shownComposition(page)).toBe(inFlight)
  expect(backend.count(inFlight)).toBe(1)

  // The remaining alternate is queued again for the new selection.
  await expect.poll(() => backend.count(other), { timeout: PREFETCH_DELAY_MS + 3000 }).toBe(1)
  await backend.release(other)
  expect(backend.posts.length).toBe(3)
})

test('closing quick view while the selection renders drops the queued prefetches', async ({ page }) => {
  const backend = new FakeVtoBackend()
  backend.hold(M_BLUE)
  await openQuickView(page, backend)
  await expect.poll(() => backend.compositions()).toEqual([M_BLUE])

  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await backend.release(M_BLUE)

  await page.waitForTimeout(PREFETCH_DELAY_MS + 1500)
  expect(backend.compositions()).toEqual([M_BLUE])
})

test('closing quick view while a prefetch runs does not start the next one', async ({ page }) => {
  const backend = new FakeVtoBackend()
  backend.hold(S_BLUE, L_BLUE)
  await openQuickView(page, backend)
  await expect.poll(() => backend.posts.length, { timeout: PREFETCH_DELAY_MS + 3000 }).toBe(2)

  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await backend.release(backend.posts[1].composition)

  await page.waitForTimeout(1500)
  expect(backend.posts.length).toBe(2)
})

test('fitting room: emptying the outfit drops the alternates queued behind it', async ({ page }) => {
  const backend = new FakeVtoBackend()
  backend.hold(M_BLUE)
  await openFittingRoom(page, backend)
  const toggle = page.getByRole('button', { name: 'Toggle try-on selection' })

  await toggle.click()
  await expect.poll(() => backend.compositions()).toEqual([M_BLUE])
  await page.waitForTimeout(SLOW_RENDER_MS)
  expect(backend.compositions(), 'the outfit alternates wait for the outfit').toEqual([M_BLUE])

  await toggle.click()
  await backend.release(M_BLUE)
  await page.waitForTimeout(PREFETCH_DELAY_MS + 1500)
  expect(backend.compositions()).toEqual([M_BLUE])
})

test('a render still in flight for one shopper is not handed to the next one to sign in', async ({ page }) => {
  const backend = new FakeVtoBackend()
  backend.hold(M_BLUE)
  await openQuickView(page, backend, [SECOND_ACCOUNT])
  await expect.poll(() => backend.posts).toEqual([{ composition: M_BLUE, user: 'a' }])

  await page.getByRole('dialog').getByText('Sign out').click()
  await page.getByRole('button', { name: /quick view/i }).click()
  await page.getByText('Sign in.', { exact: true }).click()
  await page.getByPlaceholder('Email').fill(SECOND_ACCOUNT.email)
  await page.getByPlaceholder('Password').fill('second-password')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()

  // Same outfit, different shopper: their own POST, not the first one's.
  await expect
    .poll(() => backend.posts)
    .toEqual([
      { composition: M_BLUE, user: 'a' },
      { composition: M_BLUE, user: 'b' },
    ])

  await backend.release(M_BLUE)
  await expect.poll(() => shownSrc(page)).toContain('/user-b/')
})
