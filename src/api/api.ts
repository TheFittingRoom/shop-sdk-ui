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
import { FirebaseUser } from './helpers/firebase/user'
import { getFirebaseError } from './helpers/firebase/error'
import { Config } from './helpers/config'
import * as Errors from './helpers/errors'
import { testImage } from './helpers/utils'

export class TFRAPI {
  private measurementLocations: Map<string, { name: string; sort_order: number }> = new Map()
  private colorwaySizeAssetsCache: Map<string, types.FirestoreColorwaySizeAsset> = new Map()
  private vtoFramesCache: Map<string, types.TryOnFrames> = new Map()

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
    await this.fetchCacheMeasurementLocations()

    const initResult = await this.user.onInit(this.brandId)
    return initResult.initPromise
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

  public async getColorwaySizeAssetsFromStyleId(styleId: number, skipCache: boolean): Promise<types.FirestoreColorwaySizeAsset[]> {
    console.debug('getColorwaySizeAssetsFromStyleId')

    // If using cache, check cache first for assets with this style_id
    if (!skipCache) {
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

  public async priorityTryOnWithMultiRequestCache(activeSKU: string, availableSKUs: string[], skipCache: boolean = false): Promise<types.TryOnFrames> {
    if (!this.isLoggedIn) throw new Errors.UserNotLoggedInError()

    const priorityPromise = this.getCachedOrRequestUserColorwaySizeAssetFrames(activeSKU, skipCache)

    const lowPrioritySkus = [...availableSKUs].filter(sku => sku !== activeSKU)
    lowPrioritySkus.forEach(sku => {
      this.getCachedOrRequestUserColorwaySizeAssetFrames(sku, skipCache)
    })

    return await priorityPromise
  }



  // Helper method to fetch assets from Firestore
  public async FetchAndCacheColorwaySizeAssets(
    skus: string[],
    skipCache: boolean
  ): Promise<Map<string, types.FirestoreColorwaySizeAsset>> {

    let uncachedSkus: string[] = []
    if (skipCache) {
      uncachedSkus = [...skus]
    } else {
      skus.forEach(sku => {
        if (!this.colorwaySizeAssetsCache.has(sku)) {
          uncachedSkus.push(sku)
        }
      })
    }

    if (uncachedSkus.length > 0) {
      const constraints: QueryFieldFilterConstraint[] = [
        where('brand_id', '==', this.brandId),
        where('sku', 'in', uncachedSkus),
      ]
      try {
        const querySnapshot = await this.firebase.getDocs('colorway_size_assets', constraints)

        querySnapshot.docs.forEach(doc => {
          const asset = doc.data() as types.FirestoreColorwaySizeAsset
          if (asset.sku) {
            this.colorwaySizeAssetsCache.set(asset.sku, asset)
          }
        })
      } catch (error) {
        console.error('batch fetch error:', error)
        throw error
      }
    }


    const copyOfCache = new Map<string, types.FirestoreColorwaySizeAsset>()
    for (const sku of skus) {
      const asset = this.colorwaySizeAssetsCache.get(sku)
      if (asset) {
        copyOfCache.set(sku, asset)
      } else {
        console.error(`no colorway asset found for SKU: ${sku}`)
      }
    }
    return this.colorwaySizeAssetsCache
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

  public async fetchCacheMeasurementLocations(): Promise<void> {
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

  private async watchForTryOnFrames(colorwaySizeAssetSKU: string, skipCache: boolean = false): Promise<types.TryOnFrames> {
    if (!this.isLoggedIn) throw new Errors.UserNotLoggedInError()

    let firstSnapshotProcessed = false;

    const callback = async (data: QuerySnapshot<DocumentData>) => {
      if (skipCache && !firstSnapshotProcessed) {
        firstSnapshotProcessed = true;
        return false;
      }

      const frames = data.docs[0].data()?.vto?.[this.brandId]?.[colorwaySizeAssetSKU]?.frames
      console.debug('awaitColorwaySizeAssetFrames callback, frames length:', frames?.length)
      if (!frames?.length) return false

      const tested = await testImage(frames[0])
      console.debug('awaitColorwaySizeAssetFrames testImage result:', tested)
      return tested
    }

    const userProfile = (await this.user.watchUserProfileForChanges(callback)) as types.FirestoreUser

    if (!userProfile?.vto?.[this.brandId]?.[colorwaySizeAssetSKU]?.frames?.length) throw new Errors.NoFramesFoundError()

    this.vtoFramesCache.set(colorwaySizeAssetSKU, userProfile.vto[this.brandId][colorwaySizeAssetSKU].frames)
    return userProfile.vto[this.brandId][colorwaySizeAssetSKU].frames
  }

  private async requestColorwaySizeAssetFramesByID(colorwaySizeAssetId: number): Promise<void> {
    console.debug('requestColorwaySizeAssetFramesByID')
    if (!this.isLoggedIn) throw new Errors.UserNotLoggedInError()
    if (!this.user.brandUserId) throw new Errors.BrandUserIdNotSetError()

    console.debug('Requesting frames for assetId:', colorwaySizeAssetId, 'brandUserId:', this.user.brandUserId)
    await Fetcher.Post(this.user, `/colorway-size-assets/${colorwaySizeAssetId}/frames`, {
      brand_user_id: String(this.user.brandUserId),
    })
  }

  public async getCachedOrRequestUserColorwaySizeAssetFrames(colorwaySizeAssetSKU: string, skipCache: boolean): Promise<types.TryOnFrames | null> {
    console.debug('fetchUserVTOFrames', colorwaySizeAssetSKU, 'skipCache:', skipCache)
    if (!skipCache) {
      const cached = this.vtoFramesCache.get(colorwaySizeAssetSKU)
      if (cached) {
        console.debug('returning cached frames', colorwaySizeAssetSKU)
        return cached
      }
    }

    const colorwaySizeAssetID = this.colorwaySizeAssetsCache.get(colorwaySizeAssetSKU).id
    await this.requestColorwaySizeAssetFramesByID(colorwaySizeAssetID)

    const tryOnFrames = await this.watchForTryOnFrames(colorwaySizeAssetSKU, skipCache)

    const framesTyped = tryOnFrames as types.TryOnFrames
    this.vtoFramesCache.set(colorwaySizeAssetSKU, framesTyped)
    return framesTyped
  }
}

export const initShop = (brandId: number, env: string = 'dev'): TFRAPI => {
  if (env === 'dev' || env === 'development') console.warn('TFRShop is in development mode')

  Config.getInstance().setEnv(env)

  return new TFRAPI(brandId, new Firebase())
}
