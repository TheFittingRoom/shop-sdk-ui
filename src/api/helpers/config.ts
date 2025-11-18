// Types for config keys
type FirebaseConfig = {
  FIREBASE_API_KEY: string
  FIREBASE_AUTH_DOMAIN: string
  FIREBASE_PROJECT_ID: string
  FIREBASE_STORAGE_BUCKET: string
  FIREBASE_MESSAGING_SENDER_ID: string
  FIREBASE_APP_ID: string
  FIREBASE_MEASUREMENT_ID: string
};

type APIConfig = {
  API_ENDPOINT: string
  API_VTO_TIMEOUT_MS: number
  API_AVATAR_TIMEOUT_MS: number
};

export type EnvironmentVariables = {
  FIREBASE: FirebaseConfig;
  API: APIConfig;
};

export enum Environment {
  Development = 'development',
  Production = 'production'
}

const devConfig: EnvironmentVariables = {
  FIREBASE: {
    FIREBASE_API_KEY: 'AIzaSyDfjBWzpmzb-mhGN8VSURxzLg6nkzmKUD8',
    FIREBASE_AUTH_DOMAIN: 'fittingroom-dev-5d248.firebaseapp.com',
    FIREBASE_PROJECT_ID: 'fittingroom-dev-5d248',
    FIREBASE_STORAGE_BUCKET: 'fittingroom-dev-5d248.appspot.com',
    FIREBASE_MESSAGING_SENDER_ID: '2298664147',
    FIREBASE_APP_ID: '1:2298664147:web:340bda75cd5d25f3997026',
    FIREBASE_MEASUREMENT_ID: 'G-B7GDQ1Y9LL',
  },
  API: {
    API_ENDPOINT: 'https://tfr.dev.thefittingroom.xyz',
    API_VTO_TIMEOUT_MS: 120000,
    API_AVATAR_TIMEOUT_MS: 120000,
  },
};

const prodConfig: EnvironmentVariables = {
  FIREBASE: {
    FIREBASE_API_KEY: 'AIzaSyA3kQ6w1vkA9l9lgY0nNACVPXe-QmP5T1Y',
    FIREBASE_AUTH_DOMAIN: 'fittingroom-prod.firebaseapp.com',
    FIREBASE_PROJECT_ID: 'fittingroom-prod',
    FIREBASE_STORAGE_BUCKET: 'fittingroom-prod.appspot.com',
    FIREBASE_MESSAGING_SENDER_ID: '965656825574',
    FIREBASE_APP_ID: '1:965656825574:web:933493cddc73213bd43527',
    FIREBASE_MEASUREMENT_ID: 'G-XH9VV5N6EW',
  },
  API: {
    API_ENDPOINT: 'https://tfr.p.thefittingroom.xyz',
    API_VTO_TIMEOUT_MS: 120000,
    API_AVATAR_TIMEOUT_MS: 120000,
  },
};

export class Config {
  public readonly ENV: EnvironmentVariables;

  constructor(environment: string) {
    switch (environment) {
      case 'production':
      case 'prod':
        this.ENV = prodConfig;
        break;
      case 'development':
      case 'dev':
      default:
        this.ENV = devConfig;
    }
  }
}
