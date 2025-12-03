import { ErrorResponse } from '../gen/errors'
import { Config } from './config'
import { ServerUnavailableError } from './errors'
import { FirebaseAuthUserController } from './firebase/FirebaseAuthUserController'

interface FetchParams {
  authUser: FirebaseAuthUserController
  endpointPath: string
  method: string
  body?: Record<string, any>
  useToken?: boolean
}

export class Fetcher {
  private endpoint: string

  constructor(private config: Config) {
    this.endpoint = this.config.ENV.API.API_ENDPOINT;
  }

  private async Fetch({ authUser: authUser, endpointPath, method, body, useToken = true }: FetchParams): Promise<Response> {
    const url = this.getUrl(endpointPath, useToken)
    const headers = await this.getHeaders(authUser, useToken)

    const config: RequestInit = { method, headers, credentials: 'omit' }
    if (body && method !== 'GET') {
      config.body = JSON.stringify(body)
    }

    const res = await fetch(url, config)
    console.debug("fetch response:", res.status, res.url)
    if (res.ok) return res
    if (res.status === 500) throw ServerUnavailableError
    const errRes = await res.json() as ErrorResponse
    throw errRes.error
  }

  private getUrl(endpointPath: string, useToken: boolean): string {
    return useToken ? `${this.endpoint}/v1${endpointPath}` : this.endpoint + endpointPath
  }

  private async getHeaders(authUser: FirebaseAuthUserController, useToken: boolean): Promise<Record<string, string>> {
    if (!useToken) return { 'Content-Type': 'application/json' }

    return authUser.GetToken().then((token: string) => {
      return {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      }
    }).catch((error: Error) => {
      console.error(error)
      throw error
    })
  }

  async Get(user: FirebaseAuthUserController, endpointPath: string, useToken?: boolean): Promise<Response> {
    return this.Fetch({ authUser: user, endpointPath, method: 'GET', body: undefined, useToken })
  }

  async Post(
    authUser: FirebaseAuthUserController,
    endpointPath: string,
    body?: Record<string, any>,
    useToken?: boolean,
  ): Promise<Response> {
    return this.Fetch({ authUser: authUser, endpointPath, method: 'POST', body, useToken })
  }

  async Put(
    authUser: FirebaseAuthUserController,
    endpointPath: string,
    body: Record<string, any>,
    useToken?: boolean,
  ): Promise<Response> {
    return this.Fetch({ authUser: authUser, endpointPath, method: 'PUT', body, useToken })
  }

  async Patch(
    authUser: FirebaseAuthUserController,
    endpointPath: string,
    body: Record<string, any>,
    useToken?: boolean,
  ): Promise<Response> {
    return this.Fetch({ authUser: authUser, endpointPath, method: 'PATCH', body, useToken })
  }

  async Delete(
    authUser: FirebaseAuthUserController,
    endpointPath: string,
    body?: Record<string, any>,
    useToken?: boolean,
  ): Promise<Response> {
    return this.Fetch({ authUser: authUser, endpointPath, method: 'DELETE', body, useToken })
  }
}
