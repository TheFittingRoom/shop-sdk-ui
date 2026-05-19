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
