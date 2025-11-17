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

type EnvironmentVariables = {
  FIREBASE: FirebaseConfig;
  API: APIConfig;
};

export enum Environment {
  Development = 'development',
  Production = 'production'
}

export class Config {
  private env: Environment;
  public ENV: EnvironmentVariables;

  constructor(env: string) {
    switch (env) {
      case 'production':
      case 'prod':
        this.env = Environment.Production;
        break;
      case 'development':
      case 'dev':
      default:
        this.env = Environment.Development;
    }
  }
}
