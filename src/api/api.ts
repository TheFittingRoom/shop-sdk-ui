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
import { FirebaseUser } from './helpers/firebase/firebase-user'
import { getFirebaseError } from './helpers/firebase/firebase-error'
import { Config } from './helpers/config'
import * as Errors from './helpers/errors'
import { testImage } from './utils'

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
    return !this.firebase || Boolean(this.user.id)
  }

  public async onInit(): Promise<boolean> {
    await this.getMeasurementLocations()

    return this.firebase.onInit(this.brandId)
  }

  public async getRecommendedSizes(styleId: number): Promise<SizeFitRecommendation | null> {
    if (!this.isLoggedIn) throw new Errors.UserNotLoggedInError()

    try {
      const res = await Fetcher.Get(this.user, `/styles/${String(styleId)}/recommendation`)
      const data = (await res.json()) as SizeFitRecommendation

      if (!data?.fits?.length || !data?.recommended_size?.id) return null

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
      console.debug('colorwaySizeAsset:', data)
      return data
    } catch (error) {
      console.debug('getColorwayAsset error:', colorwaySizeAssetSku, error.message)
      throw error
    }
  }

  public async getColorwaySizeAssetsFromStyleId(styleId: number): Promise<types.FirestoreColorwaySizeAsset[]> {
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
      .sort((a, b) => (a.sort_order < b.sort_order ? -1 : 0))
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
    console.debug('GetStyle:', styleId)
    try {
      const doc = await this.firebase.getDoc('styles', String(styleId))
      console.debug('style fetched:', styleId)
      return doc as FirestoreStyle
    } catch (error) {
      console.debug('GetStyle error:', styleId, error)
      return getFirebaseError(error)
    }
  }

  public getMeasurementLocationName(location: string): string {
    return this.measurementLocations.has(location) ? this.measurementLocations.get(location).name : location
  }

  public getMeasurementLocationSortOrder(location: string): number {
    return this.measurementLocations.has(location) ? this.measurementLocations.get(location).sort_order : Infinity
  }

  // Optimized batch processing for multiple SKUs with proper ordering
  public async tryOnBatch(skus: string[], prioritySku?: string): Promise<Map<string, types.TryOnFrames>> {
    if (!this.isLoggedIn) throw new Errors.UserNotLoggedInError()

    const results = new Map<string, types.TryOnFrames>()
    const uniqueSkus = [...new Set(skus)]

    // Step 1: Batch fetch all colorway size assets (avoids N+1 queries)
    const colorwayAssets = await this.batchGetColorwaySizeAssetsFromSkus(uniqueSkus)

    // Step 2: Check cache for existing frames first
    const cachePromises = uniqueSkus.map(async (sku) => {
      const asset = colorwayAssets.get(sku)
      if (!asset) return { sku, frames: null, fromCache: false }

      try {
        const frames = await this.fetchCachedColorwaySizeAssetFrames(asset.sku)
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

    // Step 3: Request frames for uncached SKUs in batch (maintain input order)
    if (uncachedSkus.length > 0) {
      // Create request promises that maintain the original order
      const requestPromises = uncachedSkus.map(async (sku) => {
        const asset = colorwayAssets.get(sku)
        if (!asset) return { sku, frames: null as types.TryOnFrames | null, success: false, retryable: false }

        try {
          await this.requestColorwaySizeAssetFramesByID(asset.id)
          const frames = await this.awaitColorwaySizeAssetFrames(asset.sku)
          return { sku, frames: frames as types.TryOnFrames, success: true, retryable: false }
        } catch (error) {
          console.error(`Failed to get frames for SKU ${sku}:`, error)

          // Handle try-on in progress errors in batch processing
          if (this.isTryOnInProgressError(error)) {
            return { sku, frames: null as types.TryOnFrames | null, success: false, retryable: true }
          }

          return { sku, frames: null as types.TryOnFrames | null, success: false, retryable: false }
        }
      })

      const requestResults = await Promise.all(requestPromises)

      // Process results maintaining the original order
      const uncachedSkusWithResults = uncachedSkus.map((sku, index) => ({
        sku,
        result: requestResults[index]
      }))

      // Separate successful results from failed ones (maintaining order)
      const successfulResults = uncachedSkusWithResults.filter(({ result }) => result.success && result.frames)
      const retryableResults = uncachedSkusWithResults.filter(({ result }) => !result.success && result.retryable)

      // Add successful results to the final map (in order)
      successfulResults.forEach(({ sku, result }) => {
        if (result.frames) {
          results.set(sku, result.frames)
        }
      })

      // Retry retryable results once with delay (maintaining order)
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

        // Process retry results maintaining the original order
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

    // Step 4: If priority SKU exists and not in results, ensure it's processed first
    if (prioritySku && !results.has(prioritySku) && colorwayAssets.has(prioritySku)) {
      try {
        const priorityAsset = colorwayAssets.get(prioritySku)
        if (priorityAsset) {
          await this.requestColorwaySizeAssetFramesByID(priorityAsset.id)
          const priorityFrames = await this.awaitColorwaySizeAssetFrames(priorityAsset.sku)
          results.set(prioritySku, priorityFrames)
        }
      } catch (error) {
        console.error(`Failed to get priority frames for SKU ${prioritySku}:`, error)
      }
    }

    return results
  }

  // Optimized single SKU tryOn (uses batch processing internally)
  public async tryOn(sku: string): Promise<types.TryOnFrames> {
    if (!this.isLoggedIn) throw new Errors.UserNotLoggedInError()

    return await this.performSingleTryOn(sku)
  }

  private async performSingleTryOn(sku: string, retryCount: number = 0): Promise<types.TryOnFrames> {
    const maxRetries = 3
    const retryDelay = 1000 * Math.pow(2, retryCount) // Exponential backoff: 1s, 2s, 4s

    const colorwaySizeAsset = await this.getColorwaySizeAssetFromSku(sku)

    try {
      const frames = await this.fetchCachedColorwaySizeAssetFrames(colorwaySizeAsset.sku)
      return frames
    } catch (error) {
      if (!(error instanceof Errors.NoFramesFoundError)) throw error
    }

    try {
      await this.requestColorwaySizeAssetFramesByID(colorwaySizeAsset.id)
    } catch (error) {
      // Check if this is a "try-on in progress" error from the API
      if (this.isTryOnInProgressError(error)) {
        if (retryCount < maxRetries) {
          console.log(`Try-on already in progress for SKU ${sku}, retrying in ${retryDelay}ms (attempt ${retryCount + 1}/${maxRetries})`)
          await this.delay(retryDelay)
          return this.performSingleTryOn(sku, retryCount + 1)
        } else {
          throw new Error(`Try-on operation already in progress for SKU ${sku}. Please wait for the current operation to complete.`)
        }
      }

      throw new Error(
        `Failed to request frames for colorway size asset ${colorwaySizeAsset.id}: ${error.message || error}`,
      )
    }

    try {
      return this.awaitColorwaySizeAssetFrames(colorwaySizeAsset.sku)
    } catch (error) {
      if (error?.error === Errors.AvatarNotCreated) throw new Errors.AvatarNotCreatedError()

      throw new Errors.NoStylesFoundError()
    }
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
  private async batchGetColorwaySizeAssetsFromSkus(skus: string[], forceRefresh: boolean = false): Promise<Map<string, types.FirestoreColorwaySizeAsset>> {
    const results = new Map<string, types.FirestoreColorwaySizeAsset>()

    if (!forceRefresh) {
      // Check cache first (unless forceRefresh is true)
      const uncachedSkus: string[] = []

      skus.forEach(sku => {
        const cachedAsset = this.colorwaySizeAssetsCache.get(sku)
        if (cachedAsset) {
          results.set(sku, cachedAsset)
        } else {
          uncachedSkus.push(sku)
        }
      })

      // Batch fetch uncached assets
      if (uncachedSkus.length > 0) {
        await this.fetchAssetsFromFirestore(uncachedSkus, results)
      }
    } else {
      // Force refresh - fetch all SKUs from Firestore
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
    try {
      const doc = await this.firebase.getDoc('style_garment_categories', String(styleId))

      return doc as FirestoreStyleGarmentCategory
    } catch (error) {
      return getFirebaseError(error)
    }
  }

  public async GetStyleCategory(id: number): Promise<FirestoreStyleCategory | null> {
    try {
      const doc = await this.firebase.getDoc('style_categories', String(id))

      return doc as FirestoreStyleCategory
    } catch (error) {
      return getFirebaseError(error)
    }
  }

  public async GetGarmentCategory(id: number): Promise<FirestoreGarmentCategory | null> {
    try {
      const doc = await this.firebase.getDoc('garment_categories', String(id))

      return doc as FirestoreGarmentCategory
    } catch (error) {
      return getFirebaseError(error)
    }
  }

  private async getMeasurementLocations(): Promise<void> {
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
    try {
      const docs = await this.firebase.getDocs('measurement_locations', [])

      return docs.docs.map((doc) => doc.data()) as FirestoreMeasurementLocation[]
    } catch (error) {
      throw getFirebaseError(error)
    }
  }

  private async awaitColorwaySizeAssetFrames(colorwaySizeAssetSKU: string): Promise<types.TryOnFrames> {
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
    if (!this.isLoggedIn) throw new Errors.UserNotLoggedInError()
    if (!this.user.brandUserId) throw new Errors.BrandUserIdNotSetError()

    await Fetcher.Post(this.user, `/colorway-size-assets/${colorwaySizeAssetId}/frames`, {
      brand_user_id: String(this.user.brandUserId),
    })
  }

  private async fetchCachedColorwaySizeAssetFrames(colorwaySizeAssetSKU: string): Promise<types.TryOnFrames> {
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
