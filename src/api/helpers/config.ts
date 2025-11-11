export class Config {
  private static instance: Config
  private env: string

  private constructor() {}

  public static getInstance(): Config {
    if (!Config.instance) Config.instance = new Config()
    return Config.instance
  }

  public setEnv(env: string) {
    switch (env) {
      case 'production':
      case 'prod':
        this.env = 'prod'
        break

      case 'development':
      case 'dev':
      default:
        this.env = 'dev'
    }
  }

  public get firebase() {
    if (this.env === 'prod') return prodKeys.firebase
    return devKeys.firebase
  }

  public get api() {
    if (this.env === 'prod') return prodKeys.api
    return devKeys.api
  }

  public get config() {
    if (this.env === 'prod') return prodKeys.config
    return devKeys.config
  }
}

const devKeys = {
  firebase: {
    apiKey: process.env.DEV_FIREBASE_API_KEY,
    authDomain: process.env.DEV_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.DEV_FIREBASE_PROJECT_ID,
    storageBucket: process.env.DEV_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.DEV_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.DEV_FIREBASE_APP_ID,
  },
  api: {
    url: process.env.DEV_API_ENDPOINT,
  },
  config: {
    avatarTimeout: Number(process.env.DEV_AVATAR_TIMEOUT_MS),
    vtoTimeout: Number(process.env.DEV_VTO_TIMEOUT_MS),
  },
}

const prodKeys = {
  firebase: {
    apiKey: process.env.PROD_FIREBASE_API_KEY,
    authDomain: process.env.PROD_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.PROD_FIREBASE_PROJECT_ID,
    storageBucket: process.env.PROD_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.PROD_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.PROD_FIREBASE_APP_ID,
  },
  api: {
    url: process.env.PROD_API_ENDPOINT,
  },
  config: {
    avatarTimeout: Number(process.env.PROD_AVATAR_TIMEOUT_MS),
    vtoTimeout: Number(process.env.PROD_VTO_TIMEOUT_MS),
  },
}
