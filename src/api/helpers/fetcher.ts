import { FirebaseUser } from './firebase/user'
import { Config } from './config'
import { ServerUnavailableError } from './errors'

interface FetchParams {
  user: FirebaseUser
  endpointPath: string
  method: string
  body?: Record<string, any>
  useToken?: boolean
}

export class Fetcher {
  private static get endpoint() {
    const api = Config.getInstance().api

    return api.url
  }

  private static async Fetch({ user, endpointPath, method, body, useToken = true }: FetchParams): Promise<Response> {
    const url = this.getUrl(endpointPath, useToken)
    const headers = await this.getHeaders(user, useToken)

    const config: RequestInit = { method, headers, credentials: 'omit' }
    if (body && method !== 'GET') {
      config.body = JSON.stringify(body)
    }

    try {
      const res = await fetch(url, config)
      if (res.ok) return res
      if (res.status === 500) throw new ServerUnavailableError(res.statusText || 'Internal server error')

      Promise.resolve(res)
      const errorResponse = await res.json().
        catch(() => {
          return Promise.reject(errorResponse)
        })
    } catch (error) {
      throw error
    }
  }

  private static getUrl(endpointPath: string, useToken: boolean): string {
    return useToken ? `${this.endpoint}/v1${endpointPath}` : this.endpoint + endpointPath
  }

  private static async getHeaders(user: FirebaseUser, useToken: boolean): Promise<Record<string, string>> {
    if (!useToken) return { 'Content-Type': 'application/json' }

    const token = await user.getToken()
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    }
  }

  static Get(user: FirebaseUser, endpointPath: string, useToken?: boolean): Promise<Response> {
    return this.Fetch({ user, endpointPath, method: 'GET', body: undefined, useToken })
  }

  static Post(
    user: FirebaseUser,
    endpointPath: string,
    body?: Record<string, any>,
    useToken?: boolean,
  ): Promise<Response> {
    return this.Fetch({ user, endpointPath, method: 'POST', body, useToken })
  }

  static Put(
    user: FirebaseUser,
    endpointPath: string,
    body: Record<string, any>,
    useToken?: boolean,
  ): Promise<Response> {
    return this.Fetch({ user, endpointPath, method: 'PUT', body, useToken })
  }

  static Patch(
    user: FirebaseUser,
    endpointPath: string,
    body: Record<string, any>,
    useToken?: boolean,
  ): Promise<Response> {
    return this.Fetch({ user, endpointPath, method: 'PATCH', body, useToken })
  }

  static Delete(
    user: FirebaseUser,
    endpointPath: string,
    body?: Record<string, any>,
    useToken?: boolean,
  ): Promise<Response> {
    return this.Fetch({ user, endpointPath, method: 'DELETE', body, useToken })
  }
}
