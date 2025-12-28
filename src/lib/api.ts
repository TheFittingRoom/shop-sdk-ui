import {
  // FirestoreColorwaySizeAsset,
  // FirestoreGarmentCategory,
  // FirestoreMeasurementLocation,
  // FirestoreStyle,
  // FirestoreStyleCategory,
  // FirestoreStyleGarmentCategory,
  // FirestoreUser,
  SizeFitRecommendation,
} from '@/api/gen/responses'
import { EnvName, getConfig } from '@/lib/config'
import { getAuthManager } from '@/lib/firebase'
import { useMainStore } from '@/lib/store'

let baseUrl: string
let responseCache: { [key: string]: unknown } = {}

export function _init(environment: EnvName) {
  const config = getConfig(environment)
  baseUrl = config.api.baseUrl

  useMainStore.subscribe((state, prevState) => {
    if (state.userIsLoggedIn !== prevState.userIsLoggedIn) {
      clearApiCache()
    }
  })
}

export function clearApiCache() {
  responseCache = {}
}

interface ApiRequestParams {
  useCache?: boolean
  useToken?: boolean
  method: RequestInit['method']
  endpoint: string
  body?: Record<string, any>
}

async function execApiRequest<T>(params: ApiRequestParams): Promise<T> {
  const authManager = getAuthManager()
  const { useCache, useToken, method, endpoint, body } = params

  const url = `${baseUrl}${endpoint}`

  if (useCache && responseCache[url]) {
    return responseCache[url] as T
  }

  const options: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json' },
  }
  if (useToken) {
    const token = await authManager.getAuthToken()
    options.headers = {
      ...options.headers,
      Authorization: `Bearer ${token}`,
    }
  }
  if (body) {
    options.body = JSON.stringify(body)
  }

  const response = await fetch(url, options)
  if (!response.ok) {
    throw new Error(`API request failed with status ${response.status}`)
  }
  const data = (await response.json()) as T

  if (useCache) {
    responseCache[url] = data
  }

  return data
}

export async function getSizeRecommendation(styleId: number): Promise<SizeFitRecommendation> {
  return execApiRequest<SizeFitRecommendation>({
    useCache: true,
    useToken: true,
    method: 'GET',
    endpoint: `/v1/styles/${styleId}/recommendation`,
  })
}
