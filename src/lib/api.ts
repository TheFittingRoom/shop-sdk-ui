import {
  FirestoreColorwaySizeAsset,
  FirestoreGarmentCategory,
  FirestoreMeasurementLocation,
  FirestoreStyle,
  FirestoreStyleCategory,
  FirestoreStyleGarmentCategory,
  FirestoreUser,
  SizeFitRecommendation,
} from '@/api/gen/responses'
import { EnvName, getConfig } from '@/lib/config'
import { getAuthManager } from '@/lib/firebase'

let baseUrl: string

export function _init(environment: EnvName) {
  const config = getConfig(environment)
  baseUrl = config.api.baseUrl
}

interface ApiRequestParams {
  useToken?: boolean
  method: RequestInit['method']
  endpoint: string
  body?: Record<string, any>
}

async function execApiRequest<T>(params: ApiRequestParams): Promise<T> {
  const authManager = getAuthManager()
  const { useToken, method, endpoint, body } = params
  const url = `${baseUrl}/v1${endpoint}`
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
  return data
}

export async function getSizeRecommendation(styleId: number): Promise<SizeFitRecommendation> {
  return execApiRequest<SizeFitRecommendation>({
    useToken: true,
    method: 'GET',
    endpoint: `/styles/${styleId}/recommendation`,
  })
}
