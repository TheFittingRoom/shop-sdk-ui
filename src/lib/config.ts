export interface Config {
  firebase: {
    apiKey: string
    authDomain: string
    projectId: string
    storageBucket: string
    messagingSenderId: string
    appId: string
    measurementId: string
  }
  api: {
    baseUrl: string
    // Client-side abort timeout (ms) for the synchronous VTO request, which
    // blocks while the backend renders. Guards against a hung backend.
    vtoTimeoutMs: number
    // Delay (ms) before speculative VTO prefetch requests start, measured from
    // when the selected outfit is posted. A shopper still clicking through
    // sizes doesn't trigger a prefetch render after every pick. 0 = start with
    // the selection. Only takes effect when features.vtoPrefetch is true.
    vtoPrefetchDelayMs: number
    // avatarTimeoutMs: number
  }
  asset: {
    baseUrl: string
  }
  frames: {
    baseUrl: string
  }
  links: {
    appAppleStoreUrl: string
    appGooglePlayUrl: string
    // Linked from the sign-up checkbox, as the mobile app links them.
    termsOfServiceUrl: string
    privacyPolicyUrl: string
  }
  build: {
    version: string
    commitHash: string
  }
  features: {
    // When true, the SDK speculatively pre-fetches VTO compositions for
    // sizes/colors/outfits the user hasn't selected yet (the non-priority
    // requests). The priority request for the actively-selected item
    // always fires regardless. Off while debugging to keep request
    // traffic minimal.
    vtoPrefetch: boolean
  }
}

export enum EnvName {
  DEVELOPMENT = 'development',
  // No production backend exists yet. Kept in the enum so init() reaches
  // getConfig's error for it instead of reporting an invalid name.
  PRODUCTION = 'production',
  // Hosted demo server (demo.thefittingroom.xyz).
  DEMO = 'demo',
  // The local-deployment Docker stack running on the developer's host.
  LOCAL = 'local',
}

const SHARED_CONFIG = {
  links: {
    // No country in the path, so it opens each shopper's own storefront.
    appAppleStoreUrl: 'https://apps.apple.com/app/id1577417373',
    // The app's new package id (was com.thefittingroom.marketplace, now
    // delisted).
    appGooglePlayUrl: 'https://play.google.com/store/apps/details?id=com.thefittingroom.app',
    termsOfServiceUrl: 'https://www.thefittingroom.tech/terms-of-service',
    privacyPolicyUrl: 'https://www.thefittingroom.tech/privacy-policy',
  },
  build: {
    version: `${process.env.BUILD_VERSION}`,
    commitHash: `${process.env.BUILD_COMMIT_HASH}`,
    date: `${process.env.BUILD_DATE}`,
  },
} as const

// Each API host verifies Firebase ID tokens against exactly one project, so
// firebase.projectId must be that project or every authenticated call fails.
// tests/e2e/environment-contract.spec.ts pins the pairing per host.
const CONFIGS: Record<Exclude<EnvName, EnvName.PRODUCTION>, Config> = {
  [EnvName.DEVELOPMENT]: {
    firebase: {
      apiKey: 'AIzaSyDfjBWzpmzb-mhGN8VSURxzLg6nkzmKUD8',
      authDomain: 'fittingroom-dev-5d248.firebaseapp.com',
      projectId: 'fittingroom-dev-5d248',
      storageBucket: 'fittingroom-dev-5d248.appspot.com',
      messagingSenderId: '2298664147',
      appId: '1:2298664147:web:340bda75cd5d25f3997026',
      measurementId: 'G-B7GDQ1Y9LL',
    },
    api: {
      baseUrl: 'https://tfr.dev.thefittingroom.xyz',
      vtoTimeoutMs: 120000,
      vtoPrefetchDelayMs: 3000,
    },
    // Browser-facing reads of the tfr-assets-dev bucket, addressed path-style
    // on the self-hosted store, so the bucket name is part of the base.
    // `assets.dev.thefittingroom.xyz` serves the same public bucket again;
    // this profile keeps the store host. Anonymous GET is allowed; listing is
    // not.
    asset: {
      baseUrl: 'https://objects.infra.thefittingroom.xyz/tfr-assets-dev/shop-sdk/assets/v5',
    },
    frames: {
      baseUrl: 'https://objects.infra.thefittingroom.xyz/tfr-assets-dev',
    },
    features: {
      vtoPrefetch: true,
    },
    ...SHARED_CONFIG,
  },
  [EnvName.DEMO]: {
    firebase: {
      apiKey: 'AIzaSyDfjBWzpmzb-mhGN8VSURxzLg6nkzmKUD8',
      authDomain: 'fittingroom-dev-5d248.firebaseapp.com',
      projectId: 'fittingroom-dev-5d248',
      storageBucket: 'fittingroom-dev-5d248.appspot.com',
      messagingSenderId: '2298664147',
      appId: '1:2298664147:web:340bda75cd5d25f3997026',
      measurementId: 'G-B7GDQ1Y9LL',
    },
    api: {
      baseUrl: 'https://demo.thefittingroom.xyz/api',
      vtoTimeoutMs: 120000,
      vtoPrefetchDelayMs: 3000,
    },
    asset: {
      baseUrl: 'http://demo.thefittingroom.xyz/s3/tfr-assets-dev/shop-sdk/assets/v5',
    },
    frames: {
      baseUrl: 'http://demo.thefittingroom.xyz/s3/tfr-assets-dev',
    },
    features: {
      vtoPrefetch: true,
    },
    ...SHARED_CONFIG,
  },
  [EnvName.LOCAL]: {
    firebase: {
      apiKey: 'AIzaSyDfjBWzpmzb-mhGN8VSURxzLg6nkzmKUD8',
      authDomain: 'fittingroom-dev-5d248.firebaseapp.com',
      projectId: 'fittingroom-dev-5d248',
      storageBucket: 'fittingroom-dev-5d248.appspot.com',
      messagingSenderId: '2298664147',
      appId: '1:2298664147:web:340bda75cd5d25f3997026',
      measurementId: 'G-B7GDQ1Y9LL',
    },
    api: {
      baseUrl: 'http://localhost:8080',
      vtoTimeoutMs: 120000,
      vtoPrefetchDelayMs: 3000,
    },
    asset: {
      baseUrl: 'http://localhost:9000/tfr-assets-dev/shop-sdk/assets/v5',
    },
    frames: {
      baseUrl: 'http://localhost:9000/tfr-assets-dev',
    },
    features: {
      vtoPrefetch: true,
    },
    ...SHARED_CONFIG,
  },
}

export const getConfig = (envName: EnvName): Config => {
  if (envName === EnvName.PRODUCTION) {
    throw new Error('Environment "production" is not available yet; use "development"')
  }
  return CONFIGS[envName]
}
