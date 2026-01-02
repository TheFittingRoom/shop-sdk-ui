import {
  // FirestoreColorwaySizeAsset,
  // FirestoreGarmentCategory,
  // FirestoreMeasurementLocation,
  // FirestoreStyle,
  // FirestoreStyleCategory,
  // FirestoreStyleGarmentCategory,
  // FirestoreUser,
  ColorwaySizeAsset,
  Size,
  SizeFitRecommendation,
} from '@/api/gen/responses'
import { getAuthManager } from '@/lib/firebase'
import { getStaticData, useMainStore } from '@/lib/store'

export type { ColorwaySizeAsset, Size, SizeFitRecommendation }

let baseUrl: string
let responseCache: { [key: string]: unknown } = {}

export function _init() {
  const { config } = getStaticData()
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
  return await execApiRequest<SizeFitRecommendation>({
    useCache: true,
    useToken: true,
    method: 'GET',
    endpoint: `/v1/styles/${styleId}/recommendation`,
  })
}

export async function requestVtoSingle(colorwaySizeAssetId: number) {
  await execApiRequest<{}>({
    useCache: true, // although this is a POST, we only want to send it once
    useToken: true,
    method: 'POST',
    endpoint: `/v1/colorway-size-assets/${colorwaySizeAssetId}/frames`,
  })
}
