import {
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

export async function requestVtoSingle(colorwaySizeAssetId: number) {
  await execApiRequest<void>({
    useCache: true, // although this is a POST, we only want to send it once
    useToken: true,
    method: 'POST',
    endpoint: `/v1/colorway-size-assets/${colorwaySizeAssetId}/frames`,
  })
}
