import type {
  // FirestoreColorwaySizeAsset,
  // FirestoreGarmentCategory,
  // FirestoreMeasurementLocation,
  // FirestoreStyle,
  // FirestoreStyleCategory,
  // FirestoreStyleGarmentCategory,
  // FirestoreUser,
  ColorwaySizeAsset,
  MeasurementLocationFit as GenMeasurementLocationFit,
  Size,
  SizeFit as GenSizeFit,
  SizeFitRecommendation as GenSizeFitRecommendation,
  StyleCategory,
  StyleCategoryGroup,
  VtoCompositionResponse,
} from '@/api/gen/responses'
import { getAuthManager } from '@/lib/firebase'
import { getStaticData, useMainStore } from '@/lib/store'

export enum FitClassification {
  FORM_FITTING = 'form_fitting',
  SLIM_FIT = 'slim_fit',
  REGULAR_FIT = 'regular_fit',
  RELAXED_FIT = 'relaxed_fit',
  OVERSIZED_FIT = 'oversized_fit',
}

export enum MeasurementLocation {
  NECK_BASE = 'neck_base',
  ACROSS_SHOULDER = 'across_shoulder',
  CENTER_BACK_NECK_TO_WRIST = 'cb_neck_to_wrist',
  SLEEVE_LENGTH_FROM_SHOULDER_POINT = 'sleeve_length_from_shoulder_point',
  BUST = 'bust',
  WAIST = 'waist',
  LOW_WAIST = 'low_waist',
  LOW_HIP = 'low_hip',
  HIGH_HIP = 'high_hip',
  THIGH = 'thigh',
  INSEAM = 'inseam',
  HSP_TO_LOW_HIP = 'hsp_to_low_hip',
  HSP_TO_CROTCH = 'hsp_to_crotch',
  LOW_HIP_BOTTOMS = 'low_hip_bottoms',
  HIGH_HIP_BOTTOMS = 'high_hip_bottoms',
}

export enum Fit {
  TOO_TIGHT = 'too_tight',
  TIGHT = 'tight',
  SLIGHTLY_TIGHT = 'slightly_tight',
  PERFECT_FIT = 'perfect_fit',
  SLIGHTLY_LOOSE = 'slightly_loose',
  LOOSE = 'loose',
  OVERSIZED = 'oversized',
  TOO_SHORT = 'too_short',
  SHORT = 'short',
  SLIGHTLY_SHORT = 'slightly_short',
  SLIGHTLY_LONG = 'slightly_long',
  LONG = 'long',
  TOO_LONG = 'too_long',
}

export interface MeasurementLocationFit extends GenMeasurementLocationFit {
  measurement_location: MeasurementLocation
  fit: Fit
}

export interface SizeFit extends GenSizeFit {
  measurement_location_fits: MeasurementLocationFit[]
}

export interface SizeFitRecommendation extends GenSizeFitRecommendation {
  fit_classification: FitClassification
  fits: SizeFit[]
}

export type { ColorwaySizeAsset, Size }

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
  body?: Record<string, unknown>
  // Abort the request after this many ms. Used by long-running synchronous
  // endpoints (VTO) so a hung backend doesn't leave the request pending
  // forever. Omitted = no client-side timeout (browser default).
  timeoutMs?: number
}

async function execApiRequest<T>(params: ApiRequestParams): Promise<T> {
  const authManager = getAuthManager()
  const { useCache, useToken, method, endpoint, body, timeoutMs } = params

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

  let timeoutHandle: ReturnType<typeof setTimeout> | undefined
  if (timeoutMs && timeoutMs > 0) {
    const controller = new AbortController()
    options.signal = controller.signal
    timeoutHandle = setTimeout(() => controller.abort(), timeoutMs)
  }

  let response: Response
  try {
    response = await fetch(url, options)
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle)
    }
  }

  if (!response.ok) {
    // Surface the backend's error message (helpers.Error returns
    // `{"error": "..."}`) so callers can show something meaningful.
    let detail = ''
    try {
      const errBody = await response.json()
      if (errBody && typeof errBody.error === 'string') {
        detail = errBody.error
      }
    } catch {
      // Body absent or not JSON — fall back to the status code.
    }
    throw new Error(detail || `API request failed with status ${response.status}`)
  }
  let data: T
  if (response.status === 204) {
    data = { noResponse: true } as T
  } else {
    data = (await response.json()) as T
  }

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

export async function getStyleCategories(): Promise<StyleCategory[]> {
  return await execApiRequest<StyleCategory[]>({
    useCache: true,
    useToken: true,
    method: 'GET',
    endpoint: '/v1/style-categories',
  })
}

export async function getStyleCategoryGroups(): Promise<StyleCategoryGroup[]> {
  return await execApiRequest<StyleCategoryGroup[]>({
    useCache: true,
    useToken: true,
    method: 'GET',
    endpoint: '/v1/style-category-groups',
  })
}

export type VtoCompositionItem = {
  colorway_size_asset_id: number
  untucked?: boolean
}

// In-flight VTO requests keyed by canonical composition key. A second
// identical requestVto() call while one is still in flight returns the
// existing promise instead of issuing another POST — a strong guarantee
// that the SDK never has duplicate in-flight VTO requests. Living in the
// API layer means the guarantee holds across every caller (both VTO
// overlays). The entry is removed once the request settles, so a later
// retry can re-issue.
const inFlightVtoRequests = new Map<string, Promise<VtoCompositionResponse>>()

// canonicalVtoKey builds a stable key from the request items, sorted by
// (colorway_size_asset_id, untucked) so submission order doesn't matter —
// the same ordering the backend hashes into the composition token.
function canonicalVtoKey(items: VtoCompositionItem[]): string {
  const normalized = items
    .map((i) => ({ csa: i.colorway_size_asset_id, untucked: !!i.untucked }))
    .sort((a, b) => a.csa - b.csa || Number(a.untucked) - Number(b.untucked))
  return JSON.stringify(normalized)
}

// requestVto dispatches a 1..4-garment VTO composition. The endpoint is
// synchronous: the backend calls sim-vis inline and returns the rendered
// frame paths directly, so the resolved VtoCompositionResponse already
// carries `frames`. A render failure surfaces as a rejected promise
// (HTTP 500 → thrown Error with the backend's message).
//
// Identical concurrent calls are deduped: while a composition's request is
// in flight, callers share one promise and one POST.
export function requestVto(items: VtoCompositionItem[]): Promise<VtoCompositionResponse> {
  const key = canonicalVtoKey(items)
  const existing = inFlightVtoRequests.get(key)
  if (existing) {
    return existing
  }

  const promise = execApiRequest<VtoCompositionResponse>({
    useToken: true,
    method: 'POST',
    endpoint: '/v1/vto-compositions',
    body: { items },
    timeoutMs: getStaticData().config.api.vtoTimeoutMs,
  }).finally(() => {
    inFlightVtoRequests.delete(key)
  })
  inFlightVtoRequests.set(key, promise)
  return promise
}
