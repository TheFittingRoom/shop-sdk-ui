import type { Page, Route } from '@playwright/test'
import { expect, test } from '@playwright/test'
import type { BootSdkOptions } from './helpers/boot'
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
    avatar_frames: ['user-test-uid-2/avatar-7/frames/image_0.jpg', 'user-test-uid-2/avatar-7/frames/image_1.jpg'],
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
  // The avatar renders are made against, as the backend uses the caller's
  // latest one.
  avatar = 'avatar-1'
  private readonly held = new Set<string>()
  private readonly failing = new Set<string>()
  private readonly pending = new Map<string, { user: VtoPost['user']; respond: () => Promise<void> }[]>()

  hold(...compositions: string[]) {
    compositions.forEach((c) => this.held.add(c))
  }

  fail(...compositions: string[]) {
    compositions.forEach((c) => this.failing.add(c))
  }

  // With a user, answers only that user's pending requests and keeps holding.
  async release(composition: string, user?: VtoPost['user']) {
    if (!user) {
      this.held.delete(composition)
    }
    const waiting = this.pending.get(composition) ?? []
    const answered = waiting.filter((w) => !user || w.user === user)
    this.pending.set(
      composition,
      waiting.filter((w) => !answered.includes(w)),
    )
    await Promise.all(answered.map((w) => w.respond()))
  }

  compositions(): string[] {
    return this.posts.map((p) => p.composition)
  }

  count(composition: string, user?: VtoPost['user']): number {
    return this.posts.filter((p) => p.composition === composition && (!user || p.user === user)).length
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
    const avatar = this.avatar
    // Frame paths carry the user, avatar and composition, so the test can
    // tell from the <img> which response is on screen.
    const respond = () =>
      this.failing.has(composition)
        ? route.fulfill({ status: 500, json: { error: 'render failed' } })
        : route.fulfill({
            json: {
              token: `tok-${composition}`,
              frames: [0, 1].map((i) => `user-${user}/${avatar}/vto-${composition}/frames/image_${i}.png`),
            },
          })
    if (this.held.has(composition)) {
      this.pending.set(composition, [...(this.pending.get(composition) ?? []), { user, respond }])
      return
    }
    await respond()
  }
}

async function openQuickView(page: Page, backend: FakeVtoBackend, accounts?: BootSdkOptions['accounts']) {
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

test('opening the product page readies the garment quick view would try on, without rendering', async ({ page }) => {
  const backend = new FakeVtoBackend()
  const prefetched: string[] = []
  await bootSdk(page, {
    currentProduct: PRODUCT,
    firestoreDocs: { styles: { 'style-1': TEST_SEEDED_STYLE } },
    apiOverrides: {
      sizeRecommendation: (route) => route.fulfill({ json: SIZE_RECOMMENDATION }),
      vtoComposition: backend.route,
      vtoPrefetch: (route) => {
        prefetched.push(new URL(route.request().url()).pathname.split('/').pop() ?? '')
        return route.fulfill({ status: 204 })
      },
    },
  })
  // The recommended size in the PDP's color, as quick view opens on it.
  await expect.poll(() => prefetched).toEqual([M_BLUE])
  expect(backend.posts).toEqual([])
})

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

// The Firebase mocks fixtures/host.html exposes, for changes made while an
// overlay stays open.
interface TestMocks {
  auth: { login(email: string, password: string): Promise<unknown> }
  firestore: {
    setDocData(collection: string, docId: string, data: unknown): Promise<void>
    mergeDocData(collection: string, docId: string, data: unknown): Promise<void>
  }
}

function signInWithoutClosing(page: Page, email: string) {
  return page.evaluate(async (email) => {
    await (window as unknown as { __TFR_TEST_MOCKS__: TestMocks }).__TFR_TEST_MOCKS__.auth.login(email, 'password')
  }, email)
}

function writeUserDoc(page: Page, uid: string, data: unknown, merge: boolean) {
  return page.evaluate(
    async ({ uid, data, merge }) => {
      const { firestore } = (window as unknown as { __TFR_TEST_MOCKS__: TestMocks }).__TFR_TEST_MOCKS__
      await (merge ? firestore.mergeDocData('users', uid, data) : firestore.setDocData('users', uid, data))
    },
    { uid, data, merge },
  )
}

function sizeButton(page: Page, size: SizeLabel) {
  return page.getByRole('dialog').getByRole('button', { name: size, exact: true })
}

function colorSelect(page: Page) {
  return page.getByRole('dialog').locator('select')
}

const VTO_ERROR = /load the try-on/

test('the prefetches go out together after the delay, without waiting for a slow selected render', async ({ page }) => {
  const backend = new FakeVtoBackend()
  backend.hold(M_BLUE, S_BLUE, L_BLUE)
  await openQuickView(page, backend)

  await expect.poll(() => backend.compositions()).toEqual([M_BLUE])
  await page.waitForTimeout(PREFETCH_DELAY_MS - 1000)
  expect(backend.compositions(), 'no prefetch before the delay').toEqual([M_BLUE])

  // The delay runs from the selection, so the other sizes are ready by the
  // time the shopper switches, even while the selected render is slow.
  await expect.poll(() => backend.posts.length, { timeout: 3000 }).toBe(3)
  expect(backend.compositions().slice(1).sort()).toEqual([L_BLUE, S_BLUE].sort())
  expect(await shownComposition(page)).toBeNull()

  await backend.release(M_BLUE)
  await expect.poll(() => shownComposition(page)).toBe(M_BLUE)
  await backend.release(S_BLUE)
  await backend.release(L_BLUE)
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
  await expect.poll(() => backend.posts.length, { timeout: PREFETCH_DELAY_MS + 3000 }).toBe(3)

  await sizeButton(page, 'S').click()
  await page.waitForTimeout(500)
  expect(backend.count(S_BLUE)).toBe(1)

  await backend.release(S_BLUE)
  await expect.poll(() => shownComposition(page)).toBe(S_BLUE)
  expect(backend.count(S_BLUE)).toBe(1)

  // L is still in flight from the first selection, so the new one does not
  // post it again.
  await page.waitForTimeout(PREFETCH_DELAY_MS + 1000)
  await backend.release(L_BLUE)
  expect(backend.count(L_BLUE)).toBe(1)
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

test('closing quick view after the prefetches start posts nothing further', async ({ page }) => {
  const backend = new FakeVtoBackend()
  backend.hold(S_BLUE, L_BLUE)
  await openQuickView(page, backend)
  await expect.poll(() => backend.posts.length, { timeout: PREFETCH_DELAY_MS + 3000 }).toBe(3)

  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await backend.release(S_BLUE)
  await backend.release(L_BLUE)

  await page.waitForTimeout(1500)
  expect(backend.posts.length).toBe(3)
})

test('fitting room: emptying the outfit before the delay drops its alternates', async ({ page }) => {
  const backend = new FakeVtoBackend()
  backend.hold(M_BLUE)
  await openFittingRoom(page, backend)
  const toggle = page.getByRole('button', { name: 'Toggle try-on selection' })

  await toggle.click()
  await expect.poll(() => backend.compositions()).toEqual([M_BLUE])
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

test('a user switch while quick view stays open posts for the new user and ignores the old reply', async ({ page }) => {
  const backend = new FakeVtoBackend()
  backend.hold(M_BLUE)
  await openQuickView(page, backend, [SECOND_ACCOUNT])
  await expect.poll(() => backend.posts).toEqual([{ composition: M_BLUE, user: 'a' }])

  await signInWithoutClosing(page, SECOND_ACCOUNT.email)
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect
    .poll(() => backend.posts)
    .toEqual([
      { composition: M_BLUE, user: 'a' },
      { composition: M_BLUE, user: 'b' },
    ])

  await backend.release(M_BLUE, 'a')
  await page.waitForTimeout(500)
  expect(await shownSrc(page), "the first shopper's late render").toBeNull()

  await backend.release(M_BLUE, 'b')
  await expect.poll(() => shownSrc(page)).toContain('/user-b/')
})

test('a new avatar while quick view stays open posts again and stops showing the old frames', async ({ page }) => {
  const backend = new FakeVtoBackend()
  await openQuickView(page, backend)
  await expect.poll(() => shownSrc(page)).toContain('/avatar-1/')

  backend.avatar = 'avatar-2'
  backend.hold(M_BLUE)
  // The avatar sync rewrites the user doc, then adds the new frames back.
  const { avatar_frames: _oldFrames, ...withoutFrames } = TEST_USER_PROFILE
  await writeUserDoc(page, TEST_UID, withoutFrames, false)
  await page.waitForTimeout(500)
  expect(backend.count(M_BLUE), 'the doc without frames is not a new avatar').toBe(1)
  expect(await shownSrc(page)).toContain('/avatar-1/')

  await writeUserDoc(
    page,
    TEST_UID,
    { avatar_frames: [`user-${TEST_UID}/avatar-2/frames/image_0.jpg`, `user-${TEST_UID}/avatar-2/frames/image_1.jpg`] },
    true,
  )
  await expect.poll(() => backend.count(M_BLUE)).toBe(2)
  expect(await shownSrc(page), 'frames of the replaced avatar').toBeNull()

  await backend.release(M_BLUE)
  await expect.poll(() => shownSrc(page)).toContain('/avatar-2/')
})

test('a user switch while the new profile is still on its way posts once for the new user', async ({ page }) => {
  const backend = new FakeVtoBackend()
  // No profile for the second account until the test writes it, so the
  // switch happens with the first shopper's profile still in the store.
  await openQuickView(page, backend, [{ ...SECOND_ACCOUNT, profile: undefined }])
  await expect.poll(() => shownSrc(page)).toContain('/user-a/')

  backend.hold(M_BLUE)
  await signInWithoutClosing(page, SECOND_ACCOUNT.email)
  await expect.poll(() => backend.count(M_BLUE, 'b')).toBe(1)
  expect(await shownSrc(page), "the first shopper's frames").toBeNull()

  await writeUserDoc(page, SECOND_ACCOUNT.uid, SECOND_ACCOUNT.profile, false)
  await page.waitForTimeout(1000)
  expect(backend.count(M_BLUE, 'b'), 'the arriving profile is not another owner').toBe(1)

  await backend.release(M_BLUE)
  await expect.poll(() => shownSrc(page)).toContain('/user-b/')
  expect(backend.count(M_BLUE, 'b')).toBe(1)
})

test("a user switch clears the previous shopper's error", async ({ page }) => {
  const backend = new FakeVtoBackend()
  backend.fail(M_BLUE)
  await openQuickView(page, backend, [SECOND_ACCOUNT])
  await expect(page.getByText(VTO_ERROR)).toBeVisible()

  backend.hold(M_BLUE)
  await signInWithoutClosing(page, SECOND_ACCOUNT.email)
  await expect.poll(() => backend.count(M_BLUE, 'b')).toBe(1)
  await expect(page.getByText(VTO_ERROR)).toHaveCount(0)
})
