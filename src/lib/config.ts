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
    // vtoTimeoutMs: number
    // avatarTimeoutMs: number
  }
  asset: {
    baseUrl: string
  }
  links: {
    appAppleStoreUrl: string
    appGooglePlayUrl: string
  }
  build: {
    version: string
    commitHash: string
  }
}

export enum EnvName {
  DEVELOPMENT = 'development',
  PRODUCTION = 'production',
}

const SHARED_CONFIG = {
  links: {
    appAppleStoreUrl: 'https://apps.apple.com/us/app/the-fitting-room-3d-body-scan/id1577417373',
    appGooglePlayUrl: 'https://play.google.com/store/apps/details?id=com.thefittingroom.marketplace',
  },
  build: {
    version: `${process.env.BUILD_VERSION}`,
    commitHash: `${process.env.BUILD_COMMIT_HASH}`,
    date: `${process.env.BUILD_DATE}`,
  },
} as const

const CONFIGS: Record<EnvName, Config> = {
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
    },
    asset: {
      baseUrl: 'https://assets.dev.thefittingroom.xyz/shop-sdk/assets/v5',
    },
    ...SHARED_CONFIG,
  },
  [EnvName.PRODUCTION]: {
    firebase: {
      apiKey: 'AIzaSyA3kQ6w1vkA9l9lgY0nNACVPXe-QmP5T1Y',
      authDomain: 'fittingroom-prod.firebaseapp.com',
      projectId: 'fittingroom-prod',
      storageBucket: 'fittingroom-prod.appspot.com',
      messagingSenderId: '965656825574',
      appId: '1:965656825574:web:933493cddc73213bd43527',
      measurementId: 'G-XH9VV5N6EW',
    },
    api: {
      baseUrl: 'https://tfr.p.thefittingroom.xyz',
    },
    asset: {
      baseUrl: 'https://assets.p.thefittingroom.xyz/shop-sdk/assets/v5',
    },
    ...SHARED_CONFIG,
  },
}

export const getConfig = (envName: EnvName): Config => {
  return CONFIGS[envName]
}
