export type Config = {
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
  },
  asset: {
    baseUrl: string
  }
}

export enum EnvName {
  DEVELOPMENT = 'development',
  PRODUCTION = 'production',
}

const configs: Record<EnvName, Config> = {
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
      // vtoTimeoutMs: 120000,
      // avatarTimeoutMs: 120000,
    },
    asset: {
      baseUrl: 'https://assets.dev.thefittingroom.xyz/shop-sdk/assets/v5',
    },
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
      // vtoTimeoutMs: 120000,
      // avatarTimeoutMs: 120000,
    },
    asset: {
      baseUrl: 'https://assets.p.thefittingroom.xyz/shop-sdk/assets/v5',
    },
  },
}

export const getConfig = (envName: EnvName): Config => {
  return configs[envName]
}
