import { DocumentData, QueryFieldFilterConstraint, QuerySnapshot, where } from 'firebase/firestore'

import * as types from '.'
import {
  SizeFitRecommendation,
  FirestoreStyle,
  FirestoreStyleGarmentCategory,
  FirestoreStyleCategory,
  FirestoreGarmentCategory,
  FirestoreMeasurementLocation
} from './gen/responses'
import { Fetcher } from './fetcher'
import { Firebase } from './helpers/firebase/firebase'
import { FirebaseUser, UserInitResult } from './helpers/firebase/user'
import { getFirebaseError } from './helpers/firebase/error'
import { Config } from './helpers/config'
import * as Errors from './helpers/errors'
import { testImage } from './helpers/utils'

export interface ParallelInitResult {
  isLoggedIn: boolean
  initPromise: Promise<boolean>
  preloadedAssets?: Map<string, types.FirestoreColorwaySizeAsset>
  preloadSkus?: string[]
}

export class TFRAPI {
  private measurementLocations: Map<string, { name: string; sort_order: number }> = new Map()
  private colorwaySizeAssetsCache: Map<string, types.FirestoreColorwaySizeAsset> = new Map()

  constructor(
    private readonly _brandId: number,
    private readonly firebase: Firebase,
  ) { }

  public get user(): FirebaseUser {
    return this.firebase.user
  }

  public get brandId(): number {
    return this._brandId
  }

  public get isLoggedIn(): boolean {
    return Boolean(this.user.id)
  }

  public async onInit(): Promise<boolean> {
    console.debug('onInit')
    await this.getMeasurementLocations()

    const initResult = await this.user.onInit(this.brandId)
    return initResult.initPromise
  }

  public async onInitParallel(skusToPreload?: string[], forceRefresh: boolean = false): Promise<ParallelInitResult> {
    console.debug('onInitParallel called at:', new Date().toISOString(), 'brandId:', this.brandId, 'skusToPreload:', skusToPreload)
    // Start measurement locations loading (non-blocking)
    const measurementLocationsPromise = this.getMeasurementLocations()

    console.debug('Calling user.onInit')
    const userInitResult: UserInitResult = await this.user.onInit(this.brandId)
    console.debug('user.onInit returned - isLoggedIn:', userInitResult.isLoggedIn, 'isInitialized:', userInitResult.isInitialized)

    // If SKUs provided, start preloading in parallel
    let preloadedAssets: Map<string, types.FirestoreColorwaySizeAsset> | undefined
    let preloadPromise: Promise<void> | undefined

    if (skusToPreload && skusToPreload.length > 0) {
      // Start SKU preloading immediately (parallel to user auth)
      preloadPromise = this.preloadColorwaySizeAssets(skusToPreload, forceRefresh).then((assets) => {
        preloadedAssets = assets
      })
    }

    const initPromise = Promise.all([
      userInitResult.initPromise,
      measurementLocationsPromise,
      preloadPromise
    ]).then(([isLoggedIn]) => {
      console.debug('initPromise resolved with isLoggedIn:', isLoggedIn)
      return isLoggedIn
    }).catch((error) => {
      console.debug('initPromise rejected:', error)
      return false
    })

    console.debug('Returning init result - isLoggedIn:', userInitResult.isLoggedIn, 'initPromise exists:', !!initPromise)
    return {
      isLoggedIn: userInitResult.isLoggedIn,
      initPromise,
      preloadedAssets,
      preloadSkus: skusToPreload
    }
  }

  private async preloadColorwaySizeAssets(skus: string[], forceRefresh: boolean = false): Promise<Map<string, types.FirestoreColorwaySizeAsset>> {
    console.debug('preloadColorwaySizeAssets')
    const results = new Map<string, types.FirestoreColorwaySizeAsset>()
    const uniqueSkus = [...new Set(skus)]

    if (forceRefresh) {
      // If forcing refresh, fetch all SKUs directly from Firestore
      await this.fetchAssetsFromFirestore(uniqueSkus, results, true)
      return results
    }

    // Check cache first
    const uncachedSkus: string[] = []
    uniqueSkus.forEach(sku => {
      const cachedAsset = this.colorwaySizeAssetsCache.get(sku)
      if (cachedAsset) {
        results.set(sku, cachedAsset)
      } else {
        uncachedSkus.push(sku)
      }
    })

    // Batch fetch uncached assets
    if (uncachedSkus.length > 0) {
      await this.fetchAssetsFromFirestore(uncachedSkus, results, true)
    }

    return results
  }

  public async setSkuWithParallel(sku: string, preloadedAssets?: Map<string, types.FirestoreColorwaySizeAsset>): Promise<types.FirestoreColorwaySizeAsset> {
    console.debug('setSkuWithParallel')
    // Check if we have preloaded asset for this SKU
    if (preloadedAssets && preloadedAssets.has(sku)) {
      const asset = preloadedAssets.get(sku)!
      this.colorwaySizeAssetsCache.set(sku, asset)
      return asset
    }

    // Check cache
    const cachedAsset = this.colorwaySizeAssetsCache.get(sku)
    if (cachedAsset) {
      return cachedAsset
    }

    // Load from Firestore (can run in parallel with user auth)
    return await this.getColorwaySizeAssetFromSku(sku)
  }

  public async getRecommendedSizes(styleId: number): Promise<SizeFitRecommendation | null> {
    if (!this.isLoggedIn) throw new Errors.UserNotLoggedInError()
    console.debug('fetching size_recommendation', styleId)
    try {
      const res = await Fetcher.Get(this.user, `/styles/${String(styleId)}/recommendation`)
      const data = (await res.json()) as SizeFitRecommendation

      if (!data?.fits?.length || !data?.recommended_size?.id) return null
      console.debug('getRecommendedSizes', data.available_sizes)
      return data
    } catch (error) {
      if (error?.error === Errors.AvatarNotCreated) throw new Errors.AvatarNotCreatedError()

      throw error
    }
  }

  public async submitTelephoneNumber(tel: string): Promise<void> {
    const sanitizedTel = tel.replace(/[^+0-9]/g, '')
    const res = await Fetcher.Post(this.user, '/ios-app-link', { phone_number: sanitizedTel }, false)
    console.debug(res)
  }

  public async getColorwaySizeAssetFromSku(colorwaySizeAssetSku: string): Promise<types.FirestoreColorwaySizeAsset> {
    console.debug('getColorwaySizeAssetFromSku', colorwaySizeAssetSku)

    // Check cache first
    const cachedAsset = this.colorwaySizeAssetsCache.get(colorwaySizeAssetSku)
    if (cachedAsset) {
      console.debug('using cached colorwaySizeAsset for sku:', colorwaySizeAssetSku)
      return cachedAsset
    }

    const constraints: QueryFieldFilterConstraint[] = [
      where('brand_id', '==', this.brandId),
      where('sku', '==', colorwaySizeAssetSku),
    ]

    try {
      const querySnapshot = await this.firebase.getDocs('colorway_size_assets', constraints)
      if (querySnapshot.empty) {
        console.debug('no colorway asset for sku:', colorwaySizeAssetSku)
        throw new Errors.NoColorwaySizeAssetsFoundError()
      }
      if (querySnapshot.size > 1) {
        throw new Error(`Multiple assets for SKU: ${colorwaySizeAssetSku}, found ${querySnapshot.size}`)
      }
      const data = querySnapshot.docs[0].data() as types.FirestoreColorwaySizeAsset
      // Cache the fetched asset
      this.colorwaySizeAssetsCache.set(colorwaySizeAssetSku, data)
      return data
    } catch (error) {
      console.debug('getColorwayAsset error:', colorwaySizeAssetSku, error.message)
      throw error
    }
  }

  public async getColorwaySizeAssetsFromStyleId(styleId: number, useCache: boolean = true): Promise<types.FirestoreColorwaySizeAsset[]> {
    console.debug('getColorwaySizeAssetsFromStyleId')

    // If using cache, check cache first for assets with this style_id
    if (useCache) {
      const cachedAssets: types.FirestoreColorwaySizeAsset[] = []
      for (const asset of this.colorwaySizeAssetsCache.values()) {
        if (asset.style_id === styleId) {
          cachedAssets.push(asset)
        }
      }

      if (cachedAssets.length > 0) {
        console.debug('using cached assets for style:', styleId)
        return cachedAssets
      }
    }

    const constraints: QueryFieldFilterConstraint[] = [
      where('brand_id', '==', this.brandId),
      where('style_id', '==', styleId),
    ]

    try {
      const querySnapshot = await this.firebase.getDocs('colorway_size_assets', constraints)

      return querySnapshot.docs.map((doc) => doc.data() as types.FirestoreColorwaySizeAsset)
    } catch (error) {
      return getFirebaseError(error)
    }
  }

  public async getMeasurementLocationsFromSku(sku: string, filledLocations: string[] = []): Promise<string[]> {
    console.debug('getMeasurementLocationsFromSku')
    const colorwaySizeAsset = await this.getColorwaySizeAssetFromSku(sku)
    if (!colorwaySizeAsset) throw new Error('No colorway size asset found for sku')

    const style = await this.GetStyle(colorwaySizeAsset.style_id)
    if (!style) throw new Error('Style category not found for style id')

    const styleGarmentCategory = await this.GetStyleGarmentCategory(style.id)
    if (!styleGarmentCategory) throw new Error('Taxonomy not found for style garment category id')

    const userProfile = this.isLoggedIn ? await this.user.getUser() : null
    const gender = userProfile?.gender || 'female'

    // Use proper typing for the measurement locations based on gender
    const measurementLocationsKey = `measurement_locations_${gender}` as const
    const measurementLocationsMap = styleGarmentCategory.measurement_locations
    const measurementLocations = (measurementLocationsMap?.[measurementLocationsKey] || []) as string[]

    const filteredLocations = !filledLocations.length
      ? measurementLocations
      : measurementLocations.filter((location) => filledLocations.includes(location))

    const locationsWithSortOrder = filteredLocations.map((location) => {
      return this.measurementLocations.has(location)
        ? this.measurementLocations.get(location)
        : { name: location, sort_order: Infinity }
    })

    return locationsWithSortOrder
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((location) => location.name)
  }

  // BrandStyleID is the SKU of the style
  public async getStyleByBrandStyleID(styleSKU: string): Promise<FirestoreStyle | null> {
    console.debug('getStyleByBrandStyleID:', styleSKU)
    try {
      const constraints: QueryFieldFilterConstraint[] = [where('brand_id', '==', this.brandId)]
      constraints.push(where('brand_style_id', '==', styleSKU))
      const querySnapshot = await this.firebase.getDocs('styles', constraints)
      const style = querySnapshot.docs?.[0]?.data() as FirestoreStyle
      console.debug('style fetched by brand id:', style)
      return style
    } catch (error) {
      console.debug('getStyleByBrandStyleID error:', styleSKU, error)
      return getFirebaseError(error)
    }
  }

  public async GetStyle(styleId: number): Promise<FirestoreStyle | null> {
    try {
      const doc = await this.firebase.getDoc('styles', String(styleId))
      return doc as FirestoreStyle
    } catch (error) {
      return getFirebaseError(error)
    }
  }

  public getMeasurementLocationName(location: string): string {
    return this.measurementLocations.has(location) ? this.measurementLocations.get(location).name : location
  }

  public getMeasurementLocationSortOrder(location: string): number {
    return this.measurementLocations.has(location) ? this.measurementLocations.get(location).sort_order : Infinity
  }

  public async tryOnBatch(skus: string[], prioritySku?: string, forceRefresh: boolean = false): Promise<Map<string, types.TryOnFrames>> {
    console.debug('tryOnBatch')
    if (!this.isLoggedIn) throw new Errors.UserNotLoggedInError()

    const results = new Map<string, types.TryOnFrames>()
    const uniqueSkus = [...new Set(skus)]

    const colorwayAssets = await this.batchGetColorwaySizeAssetsFromSKUs(uniqueSkus, forceRefresh)

    const cachePromises = uniqueSkus.map(async (sku) => {
      const asset = colorwayAssets.get(sku)
      if (!asset) return { sku, frames: null, fromCache: false }

      if (forceRefresh) {
        return { sku, frames: null, fromCache: false }
      }

      try {
        const frames = await this.fetchColorwaySizeAssetFrames(asset.sku)
        return { sku, frames, fromCache: true }
      } catch {
        return { sku, frames: null, fromCache: false }
      }
    })

    const cacheResults = await Promise.all(cachePromises)
    const uncachedSkus: string[] = []

    // Process cache results in order
    cacheResults.forEach(({ sku, frames, fromCache }) => {
      if (frames && fromCache) {
        results.set(sku, frames)
      } else {
        uncachedSkus.push(sku)
      }
    })

    if (uncachedSkus.length > 0) {
      // Separate asset validation from API requests
      const validAssets = uncachedSkus
        .map(sku => ({ sku, asset: colorwayAssets.get(sku) }))
        .filter(({ asset }) => asset !== undefined)

      const apiRequestPromises = validAssets.map(async ({ sku, asset }) => {
        try {
          await this.requestColorwaySizeAssetFramesByID(asset!.id)
          return { sku, success: true, asset }
        } catch (error) {
          console.error(`API request failed for SKU ${sku}:`, error)
          return { sku, success: false, error }
        }
      })

      const apiResults = await Promise.all(apiRequestPromises)

      const framePromises = apiResults
        .filter(result => result.success)
        .map(async (result) => {
          try {
            const frames = await this.awaitColorwaySizeAssetFrames(result.asset!.sku)
            return { sku: result.sku, frames: frames as types.TryOnFrames, success: true, retryable: false }
          } catch (error) {
            console.error(`Frame retrieval failed for SKU ${result.sku}:`, error)

            // Handle try-on in progress errors
            if (this.isTryOnInProgressError(error)) {
              return { sku: result.sku, frames: null as types.TryOnFrames | null, success: false, retryable: true }
            }

            return { sku: result.sku, frames: null as types.TryOnFrames | null, success: false, retryable: false }
          }
        })

      const requestResults = await Promise.all(framePromises)

      const uncachedSkusWithResults = uncachedSkus.map((sku, index) => ({
        sku,
        result: requestResults[index]
      }))

      const successfulResults = uncachedSkusWithResults.filter(({ result }) => result.success && result.frames)
      const retryableResults = uncachedSkusWithResults.filter(({ result }) => !result.success && result.retryable)

      successfulResults.forEach(({ sku, result }) => {
        if (result.frames) {
          results.set(sku, result.frames)
        }
      })

      if (retryableResults.length > 0) {
        console.log(`Retrying ${retryableResults.length} SKUs due to try-on in progress:`, retryableResults.map(r => r.sku))
        await this.delay(2000) // 2 second delay for batch retry

        const retryPromises = retryableResults.map(async ({ sku }) => {
          const asset = colorwayAssets.get(sku)
          if (!asset) return { sku, frames: null as types.TryOnFrames | null, success: false, retryable: false }

          try {
            await this.requestColorwaySizeAssetFramesByID(asset.id)
            const frames = await this.awaitColorwaySizeAssetFrames(asset.sku)
            return { sku, frames: frames as types.TryOnFrames, success: true, retryable: false }
          } catch (retryError) {
            console.error(`Retry failed for SKU ${sku}:`, retryError)
            return { sku, frames: null as types.TryOnFrames | null, success: false, retryable: false }
          }
        })

        const retryResults = await Promise.all(retryPromises)

        const retrySkusWithResults = retryableResults.map(({ sku }, index) => ({
          sku,
          result: retryResults[index]
        }))

        retrySkusWithResults.forEach(({ sku, result }) => {
          if (result.success && result.frames) {
            results.set(sku, result.frames)
          }
        })
      }
    }

    if (prioritySku && !results.has(prioritySku) && colorwayAssets.has(prioritySku)) {
      try {
        const priorityAsset = colorwayAssets.get(prioritySku)
        if (priorityAsset) {
          // Request priority SKU frames
          await this.requestColorwaySizeAssetFramesByID(priorityAsset.id)
          const priorityFrames = await this.awaitColorwaySizeAssetFrames(priorityAsset.sku)
          results.set(prioritySku, priorityFrames)
        }
      } catch (error) {
        console.error(`Priority SKU request failed for ${prioritySku}:`, error)
        throw new Error(`Failed to get priority frames for SKU ${prioritySku}: ${error.message || error}`)
      }
    }

    return results
  }

  public async tryOn(colorwaySizeAssetSKU: string, forceRefresh: boolean = false): Promise<types.TryOnFrames> {
    console.debug('tryOn')
    if (!this.isLoggedIn) throw new Errors.UserNotLoggedInError()

    return await this.performSingleTryOn(colorwaySizeAssetSKU, forceRefresh)
  }

  private async performSingleTryOn(sku: string, forceRefresh: boolean = false): Promise<types.TryOnFrames> {
    console.debug('performSingleTryOn')
    // Use the existing batch system for consistent caching and optimization
    const batchResult = await this.tryOnBatch([sku], sku, forceRefresh)

    const frames = batchResult.get(sku)
    if (!frames) {
      throw new Error(`Failed to get VTO frames for SKU: ${sku}`)
    }

    return frames
  }

  private isTryOnInProgressError(error: any): boolean {
    // Check for various error patterns that indicate a try-on is already in progress
    const errorMessage = error?.message?.toLowerCase() || ''
    const errorText = error?.error?.toLowerCase?.() || ''

    return errorMessage.includes('try on in progress') ||
      errorMessage.includes('try-on in progress') ||
      errorMessage.includes('already in progress') ||
      errorMessage.includes('operation in progress') ||
      errorText.includes('try on in progress') ||
      errorText.includes('try-on in progress') ||
      errorText.includes('already in progress') ||
      errorText.includes('operation in progress')
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  // Batch method to fetch multiple colorway assets efficiently
  private async batchGetColorwaySizeAssetsFromSKUs(skus: string[], forceRefresh: boolean = false): Promise<Map<string, types.FirestoreColorwaySizeAsset>> {
    console.debug('batchGetColorwaySizeAssetsFromSKUs')
    const results = new Map<string, types.FirestoreColorwaySizeAsset>()

    if (!forceRefresh) {
      const uncachedSkus: string[] = []

      skus.forEach(sku => {
        const cachedAsset = this.colorwaySizeAssetsCache.get(sku)
        if (cachedAsset) {
          results.set(sku, cachedAsset)
        } else {
          uncachedSkus.push(sku)
        }
      })

      if (uncachedSkus.length > 0) {
        await this.fetchAssetsFromFirestore(uncachedSkus, results)
      }
    } else {
      await this.fetchAssetsFromFirestore(skus, results, true)
    }

    return results
  }

  // Helper method to fetch assets from Firestore
  private async fetchAssetsFromFirestore(
    skus: string[],
    results: Map<string, types.FirestoreColorwaySizeAsset>,
    updateCache: boolean = true
  ): Promise<void> {
    console.debug('fetchAssetsFromFirestore')
    const constraints: QueryFieldFilterConstraint[] = [
      where('brand_id', '==', this.brandId),
      where('sku', 'in', skus),
    ]

    try {
      const querySnapshot = await this.firebase.getDocs('colorway_size_assets', constraints)

      querySnapshot.docs.forEach(doc => {
        const asset = doc.data() as types.FirestoreColorwaySizeAsset
        if (asset.sku) {
          results.set(asset.sku, asset)
          if (updateCache) {
            this.colorwaySizeAssetsCache.set(asset.sku, asset) // Cache for future use
          }
        }
      })

      // Handle SKUs that weren't found
      const foundSkus = new Set(querySnapshot.docs.map(doc => (doc.data() as types.FirestoreColorwaySizeAsset).sku))
      skus.forEach(sku => {
        if (!foundSkus.has(sku)) {
          console.warn(`No colorway asset found for SKU: ${sku}`)
        }
      })
    } catch (error) {
      console.error('Batch fetch error:', error)
      throw error
    }
  }

  public async GetStyleGarmentCategory(styleId: number): Promise<FirestoreStyleGarmentCategory | null> {
    console.debug('GetStyleGarmentCategory')
    try {
      const doc = await this.firebase.getDoc('style_garment_categories', String(styleId))

      return doc as FirestoreStyleGarmentCategory
    } catch (error) {
      return getFirebaseError(error)
    }
  }

  public async GetStyleCategory(id: number): Promise<FirestoreStyleCategory | null> {
    console.debug('GetStyleCategory')
    try {
      const doc = await this.firebase.getDoc('style_categories', String(id))

      return doc as FirestoreStyleCategory
    } catch (error) {
      return getFirebaseError(error)
    }
  }

  public async GetGarmentCategory(id: number): Promise<FirestoreGarmentCategory | null> {
    console.debug('GetGarmentCategory')
    try {
      const doc = await this.firebase.getDoc('garment_categories', String(id))

      return doc as FirestoreGarmentCategory
    } catch (error) {
      return getFirebaseError(error)
    }
  }

  private async getMeasurementLocations(): Promise<void> {
    console.debug('getMeasurementLocations')
    try {
      const locations = await this.fetchMeasurementLocations()

      locations.forEach((location) => {
        this.measurementLocations.set(location.name, { name: location.garment_label, sort_order: location.sort_order })
      })
    } catch (error) {
      console.error('Failed to load measurement locations:', error)
      throw error
    }
  }

  private async fetchMeasurementLocations(): Promise<FirestoreMeasurementLocation[]> {
    console.debug('fetchMeasurementLocations')
    try {
      const docs = await this.firebase.getDocs('measurement_locations', [])

      return docs.docs.map((doc) => doc.data()) as FirestoreMeasurementLocation[]
    } catch (error) {
      throw getFirebaseError(error)
    }
  }

  private async awaitColorwaySizeAssetFrames(colorwaySizeAssetSKU: string): Promise<types.TryOnFrames> {
    console.debug('awaitColorwaySizeAssetFrames')
    if (!this.isLoggedIn) throw new Errors.UserNotLoggedInError()

    const callback = async (data: QuerySnapshot<DocumentData>) => {
      const frames = data.docs[0].data()?.vto?.[this.brandId]?.[colorwaySizeAssetSKU]?.frames
      if (!frames?.length) return false

      return testImage(frames[0])
    }

    const userProfile = (await this.user.watchUserProfileForFrames(callback)) as types.FirestoreUser

    if (!userProfile?.vto?.[this.brandId]?.[colorwaySizeAssetSKU]?.frames?.length) throw new Errors.NoFramesFoundError()

    return userProfile.vto[this.brandId][colorwaySizeAssetSKU].frames
  }

  private async requestColorwaySizeAssetFramesByID(colorwaySizeAssetId: number): Promise<void> {
    console.debug('requestColorwaySizeAssetFramesByID')
    if (!this.isLoggedIn) throw new Errors.UserNotLoggedInError()
    if (!this.user.brandUserId) throw new Errors.BrandUserIdNotSetError()

    await Fetcher.Post(this.user, `/colorway-size-assets/${colorwaySizeAssetId}/frames`, {
      brand_user_id: String(this.user.brandUserId),
    })
  }

  private async fetchColorwaySizeAssetFrames(colorwaySizeAssetSKU: string): Promise<types.TryOnFrames> {
    console.debug('fetchColorwaySizeAssetFrames')
    const userProfile = await this.user.getUser()

    const frames = userProfile?.vto?.[this.brandId]?.[colorwaySizeAssetSKU]?.frames || []
    if (!frames.length) throw new Errors.NoFramesFoundError()

    const testedImage = await testImage(frames[0])
    if (!testedImage) throw new Errors.NoFramesFoundError()

    return frames as types.TryOnFrames
  }
}

export const initShop = (brandId: number, env: string = 'dev'): TFRAPI => {
  if (env === 'dev' || env === 'development') console.warn('TFRShop is in development mode')

  Config.getInstance().setEnv(env)

  return new TFRAPI(brandId, new Firebase())
}
