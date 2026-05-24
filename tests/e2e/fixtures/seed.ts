// Shared fixture data for the e2e suite. Keep narrowly typed where it crosses
// the SDK boundary (TestHooks / API response shapes); the rest can stay loose
// since the SDK is the only consumer and types are checked at use sites.

import type { FirestoreUser } from '../../../src/api/gen/responses'

export const TEST_BRAND_ID = 1
export const TEST_UID = 'test-uid-1'
export const TEST_EMAIL = 'test@example.com'
export const TEST_ID_TOKEN = 'mock-id-token-abc123'
export const TEST_PRODUCT_EXTERNAL_ID = 'gid://shopify/Product/12345'
export const TEST_PRODUCT_HANDLE = 'test-product'
export const TEST_STYLE_ID = 999

// A "happy path" user profile: avatar created, so the SDK treats the user as
// fully onboarded and won't redirect to the GET_APP / LANDING overlays.
export const TEST_USER_PROFILE: FirestoreUser = {
  brand_id: TEST_BRAND_ID,
  full_name: 'Test Shopper',
  job: '',
  avatar_status: 'CREATED',
  avatar_gender: 'female',
  avatar_frames: ['user-test/avatar-1/frames/image_0.png', 'user-test/avatar-1/frames/image_1.png'],
  is_tos_accepted: true,
  is_gte_18: true,
  // Timestamp fields are read via `firebaseDateToDayjs` only inside the
  // login-throttle path, which MockAuthManager skips entirely — so plain
  // sentinels are fine here. Cast keeps the FirestoreUser type honest.
  created_at: { seconds: 0, nanoseconds: 0 } as unknown as FirestoreUser['created_at'],
}

// Minimal ExternalProduct shape for currentProduct on PDP-flavoured tests.
export const TEST_CURRENT_PRODUCT = {
  productName: 'Test Product',
  productDescriptionHtml: '<p>Test description</p>',
  externalId: TEST_PRODUCT_EXTERNAL_ID,
  handle: TEST_PRODUCT_HANDLE,
  imageUrl: null,
  variants: [
    {
      sku: 'SKU-M-BLUE',
      size: 'M',
      color: 'Blue',
      fullName: 'Test M Blue',
      skuName: 'SKU-M-BLUE',
      priceFormatted: '$50.00',
      imageUrl: null,
    },
    {
      sku: 'SKU-S-BLUE',
      size: 'S',
      color: 'Blue',
      fullName: 'Test S Blue',
      skuName: 'SKU-S-BLUE',
      priceFormatted: '$50.00',
      imageUrl: null,
    },
  ],
}

// API response fixtures. Defaults are deliberately empty — tests that exercise
// downstream UI flows can override per-test via installApiMocks.
export const EMPTY_STYLE_CATEGORIES: unknown[] = []
export const EMPTY_STYLE_CATEGORY_GROUPS: unknown[] = []
export const EMPTY_SIZE_RECOMMENDATION = {
  recommended_size: { size: 'M', size_label: 'M' },
  fit_classification: 'regular_fit',
  fits: [],
  available_sizes: [],
}
export const TEST_VTO_COMPOSITION = {
  token: 'tok-test-1',
  frames: ['user-test/avatar-1/vto-tok-test-1/frames/image_0.png'],
}

// --- Rich VTO fixtures ----------------------------------------------------
// These let a test exercise the full quick-view VTO flow: SDK boot → style
// resolved from firestore → /v1/styles/<id>/recommendation returns sizes with
// CSAs → /v1/vto-compositions returns multiple frames → AvatarFrameViewer
// renders the first frame and useAutoRotate cycles through the rest.

// 12-frame VTO response — enough for the auto-rotate tests to assert frame
// advancement over a 1-2s window without flake risk from very small N.
export const TEST_VTO_COMPOSITION_12 = {
  token: 'tok-test-12',
  frames: Array.from({ length: 12 }, (_, i) => `user-test/avatar-1/vto-test/frames/image_${i}.png`),
}

// Minimal-but-valid SizeFitRecommendation. The recommended size has a CSA
// whose SKU matches TEST_CURRENT_PRODUCT.variants[0] so quick-view's
// setupInitialVtoData finds a usable CSA without choking on missing data.
export const TEST_SIZE_FIT_RECOMMENDATION = {
  fit_classification: 'regular_fit',
  recommended_size: {
    id: 101,
    label: 'M',
    size_value: { value: 'M' },
    colorway_size_assets: [{ id: 5001, sku: 'SKU-M-BLUE' }],
  },
  available_sizes: [
    {
      id: 101,
      label: 'M',
      size_value: { value: 'M' },
      colorway_size_assets: [{ id: 5001, sku: 'SKU-M-BLUE' }],
    },
    {
      id: 102,
      label: 'S',
      size_value: { value: 'S' },
      colorway_size_assets: [{ id: 5002, sku: 'SKU-S-BLUE' }],
    },
  ],
  fits: [
    { size_id: 101, measurement_location_fits: [] },
    { size_id: 102, measurement_location_fits: [] },
  ],
}

// One firestore-seeded style document. id matches the size-recommendation
// endpoint (/v1/styles/<id>/recommendation). external_id matches
// TEST_PRODUCT_EXTERNAL_ID so the firestore lookup hits when quick-view
// loads product data. Seed via bootSdk({ firestoreDocs: { styles: { ... } } }).
export const TEST_SEEDED_STYLE = {
  id: TEST_STYLE_ID,
  brand_id: TEST_BRAND_ID,
  external_id: TEST_PRODUCT_EXTERNAL_ID,
  style_category_name: 'tshirt',
}
