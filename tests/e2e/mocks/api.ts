import type { Page, Route } from '@playwright/test'
import {
  EMPTY_SIZE_RECOMMENDATION,
  EMPTY_STYLE_CATEGORIES,
  EMPTY_STYLE_CATEGORY_GROUPS,
  TEST_VTO_COMPOSITION,
  testDemoAvatar,
} from '../fixtures/seed'

// Per-test override hooks. Each receives the matched Route — call .fulfill /
// .abort / .continue as needed. Omit a key to use the default fixture.
export interface ApiMockOverrides {
  sizeRecommendation?: (route: Route) => Promise<void> | void
  styleCategories?: (route: Route) => Promise<void> | void
  styleCategoryGroups?: (route: Route) => Promise<void> | void
  vtoComposition?: (route: Route) => Promise<void> | void
  // PUT /v1/users/:uid (sign-up) and PUT /v1/users/:uid/gender. Default: 200.
  putUser?: (route: Route) => Promise<void> | void
  putUserGender?: (route: Route) => Promise<void> | void
  // GET /v1/demo-avatars/:gender. Default: testDemoAvatar(gender).
  demoAvatar?: (route: Route) => Promise<void> | void
  frames?: (route: Route) => Promise<void> | void
}

// 1x1 transparent PNG. Frame requests (avatar + VTO) hit `applyFrameBaseUrl`
// which prepends `config.frames.baseUrl` — so the catch-all matches any host
// once the path suffix is .png/.jpg/etc.
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
)

/**
 * Install REST-API mocks on the page. Routes are matched by path-suffix
 * regex so they work regardless of which `config.api.baseUrl` (demo / local /
 * dev / prod) the SDK is configured against.
 *
 * Order matters: more specific routes are registered first. Playwright tries
 * the most recently added route first when multiple match.
 */
export async function installApiMocks(page: Page, overrides: ApiMockOverrides = {}): Promise<void> {
  await page.route(/\/v1\/styles\/\d+\/recommendation$/, (route) => {
    if (overrides.sizeRecommendation) {
      return overrides.sizeRecommendation(route)
    }
    return route.fulfill({ json: EMPTY_SIZE_RECOMMENDATION })
  })

  await page.route(/\/v1\/style-categories$/, (route) => {
    if (overrides.styleCategories) {
      return overrides.styleCategories(route)
    }
    return route.fulfill({ json: EMPTY_STYLE_CATEGORIES })
  })

  await page.route(/\/v1\/style-category-groups$/, (route) => {
    if (overrides.styleCategoryGroups) {
      return overrides.styleCategoryGroups(route)
    }
    return route.fulfill({ json: EMPTY_STYLE_CATEGORY_GROUPS })
  })

  await page.route(/\/v1\/vto-compositions$/, (route) => {
    if (overrides.vtoComposition) {
      return overrides.vtoComposition(route)
    }
    return route.fulfill({ json: TEST_VTO_COMPOSITION })
  })

  await page.route(/\/v1\/users\/[^/]+$/, (route) => {
    if (overrides.putUser) {
      return overrides.putUser(route)
    }
    return route.fulfill({ status: 200, json: { user_id: route.request().url().split('/').pop() } })
  })

  await page.route(/\/v1\/users\/[^/]+\/gender$/, (route) => {
    if (overrides.putUserGender) {
      return overrides.putUserGender(route)
    }
    return route.fulfill({ status: 200, json: {} })
  })

  await page.route(/\/v1\/demo-avatars\/[^/]+$/, (route) => {
    if (overrides.demoAvatar) {
      return overrides.demoAvatar(route)
    }
    const gender = route.request().url().split('/').pop() ?? ''
    return route.fulfill({ json: testDemoAvatar(gender) })
  })

  // Videos (the landing screen's intro video): an empty body is enough, the
  // tests only check what is requested and shown.
  await page.route(/\.mp4(\?.*)?$/i, (route) => route.fulfill({ contentType: 'video/mp4', body: '' }))

  // Catch-all for frame images. Must come last so the more specific REST
  // routes above take precedence.
  await page.route(/\.(png|jpg|jpeg|webp)(\?.*)?$/i, (route) => {
    if (overrides.frames) {
      return overrides.frames(route)
    }
    return route.fulfill({ contentType: 'image/png', body: PNG_1X1 })
  })
}
