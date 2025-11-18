import { DocumentData, QueryFieldFilterConstraint, QuerySnapshot, where } from 'firebase/firestore'

import {
  SizeFitRecommendation,
  FirestoreStyle,
  FirestoreStyleGarmentCategory,
  FirestoreStyleCategory,
  FirestoreGarmentCategory,
  FirestoreMeasurementLocation,
  FirestoreColorwaySizeAsset,
  FirestoreUser,
} from './gen/responses'
import { Fetcher } from './helpers/fetcher'
import { FirebaseController } from './helpers/firebase/firebase'
import { FirebaseUser } from './helpers/firebase/user'
import { getFirebaseError } from './helpers/firebase/error'
import { testImage } from './helpers/utils'
import { TryOnFrames } from '.'
import { AvatarNotCreated, AvatarNotCreatedError, NoColorwaySizeAssetsFoundError, NoFramesFoundError, UserNotLoggedInError } from './helpers/errors'

import { Config } from './helpers/config'

export class TFRAPI {
  private measurementLocations: Map<string, { name: string; sort_order: number }> = new Map()
  private colorwaySizeAssetsCache: Map<string, FirestoreColorwaySizeAsset> = new Map()
  private vtoFramesCache: Map<string, TryOnFrames> = new Map()
  private readonly firebase: FirebaseController
  private readonly fetcher: Fetcher
  private style: FirestoreStyle

  constructor(
    private readonly brandID: number,
    config: Config,
  ) {
    this.firebase = new FirebaseController(config)
    this.fetcher = new Fetcher(config)
  }

  public get User(): FirebaseUser {
    return this.firebase.userController
  }

  public get BrandID(): number {
    return this.brandID
  }

  public async IsLoggedIn(): Promise<boolean> {
    return Boolean(await this.User.User())
  }

  public async GetRecommendedSizes(styleId: number): Promise<SizeFitRecommendation | null> {
    if (!this.IsLoggedIn) throw new UserNotLoggedInError()
    console.debug('fetching size_recommendation', styleId)
    try {
      const res = await this.fetcher.Get(this.User, `/styles/${String(styleId)}/recommendation`)
      const data = (await res.json()) as SizeFitRecommendation

      if (!data?.fits?.length || !data?.recommended_size?.id) return null
      console.debug('getRecommendedSizes', data.available_sizes)
      return data
    } catch (error) {
      if (error?.error === AvatarNotCreated) throw new AvatarNotCreatedError()

      throw error
    }
  }

  public async SubmitTelephoneNumber(tel: string): Promise<void> {
    const sanitizedTel = tel.replace(/[^+0-9]/g, '')
    const res = await this.fetcher.Post(this.User, '/ios-app-link', { phone_number: sanitizedTel }, false)
    console.debug(res)
  }

  public async GetCachedColorwaySizeAssetFromSku(colorwaySizeAssetSku: string): Promise<FirestoreColorwaySizeAsset> {
    const cachedAsset = this.colorwaySizeAssetsCache.get(colorwaySizeAssetSku)
    if (cachedAsset) {
      console.debug('using cached colorwaySizeAsset for sku:', colorwaySizeAssetSku)
      return cachedAsset
    }

    const constraints: QueryFieldFilterConstraint[] = [
      where('brand_id', '==', this.BrandID),
      where('sku', '==', colorwaySizeAssetSku),
    ]

    try {
      const querySnapshot = await this.firebase.getDocs('colorway_size_assets', constraints)
      if (querySnapshot.empty) {
        console.debug('no colorway asset for sku:', colorwaySizeAssetSku)
        throw new NoColorwaySizeAssetsFoundError()
      }
      if (querySnapshot.size > 1) {
        throw new Error(`Multiple assets for SKU: ${colorwaySizeAssetSku}, found ${querySnapshot.size}`)
      }
      const data = querySnapshot.docs[0].data() as FirestoreColorwaySizeAsset
      // Cache the fetched asset
      this.colorwaySizeAssetsCache.set(colorwaySizeAssetSku, data)
      return data
    } catch (error) {
      console.debug('getColorwayAsset error:', colorwaySizeAssetSku, error.message)
      throw error
    }
  }

  public async FetchCachedColorwaySizeAssetsFromStyleId(styleId: number, skipCache: boolean): Promise<FirestoreColorwaySizeAsset[]> {
    const cachedAssets: FirestoreColorwaySizeAsset[] = []
    if (!skipCache) {
      console.debug("loading colorway_size_assets from cache")
      for (const asset of this.colorwaySizeAssetsCache.values()) {
        if (asset.style_id === styleId) {
          cachedAssets.push(asset)
        }
      }
    }

    const constraints: QueryFieldFilterConstraint[] = [
      where('brand_id', '==', this.BrandID),
      where('style_id', '==', styleId),
    ]

    if (!skipCache && cachedAssets.length > 0) {
      const cachedIds = cachedAssets.map(asset => asset.id)
      console.debug("skipping cached colorway_size_assets in query", cachedIds)
      constraints.push(where('id', 'not-in', cachedIds))
    }

    try {
      const querySnapshot = await this.firebase.getDocs('colorway_size_assets', constraints)

      const newAssets = querySnapshot.docs.map((doc) => doc.data() as FirestoreColorwaySizeAsset)

      if (!skipCache) {
        console.debug("caching new assets", newAssets.length)
        newAssets.forEach(asset => {
          this.colorwaySizeAssetsCache.set(asset.sku, asset)
        })
      }

      const allAssets = [...cachedAssets, ...newAssets]
      allAssets.sort((a, b) => a.id - b.id)
      return allAssets
    } catch (error) {
      return getFirebaseError(error)
    }
  }

  public async GetMeasurementLocationsFromSku(sku: string, filledLocations: string[] = []): Promise<string[]> {
    const colorwaySizeAsset = await this.GetCachedColorwaySizeAssetFromSku(sku)
    if (!colorwaySizeAsset) throw new Error('No colorway size asset found for sku')

    const styleGarmentCategory = await this.GetStyleGarmentCategory(this.style.id)
    if (!styleGarmentCategory) throw new Error('Taxonomy not found for style garment category id')

    const userProfile = this.IsLoggedIn ? await this.User.getUser() : null
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
  public async GetStyleByBrandStyleID(styleSKU: string): Promise<FirestoreStyle | null> {
    console.debug('getStyleByBrandStyleID:', styleSKU)
    try {
      const constraints: QueryFieldFilterConstraint[] = [where('brand_id', '==', this.BrandID)]
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

  public async GetStyleByID(styleId: number): Promise<FirestoreStyle | null> {
    try {
      const doc = await this.firebase.getDoc('styles', String(styleId))
      return doc as FirestoreStyle
    } catch (error) {
      return getFirebaseError(error)
    }
  }

  public GetMeasurementLocationName(location: string): string {
    return this.measurementLocations.has(location) ? this.measurementLocations.get(location).name : location
  }

  public GetMeasurementLocationSortOrder(location: string): number {
    return this.measurementLocations.has(location) ? this.measurementLocations.get(location).sort_order : Infinity
  }

  // queues 3+ virtual try ons and only waits on the active rendered virtual tryon
  public async PriorityTryOnWithMultiRequestCache(activeSKU: string, availableSKUs: string[], skipCache: boolean = false): Promise<TryOnFrames> {
    if (!this.IsLoggedIn) throw new UserNotLoggedInError()

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
  ): Promise<Map<string, FirestoreColorwaySizeAsset>> {

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
        where('brand_id', '==', this.BrandID),
        where('sku', 'in', uncachedSkus),
      ]
      try {
        const querySnapshot = await this.firebase.getDocs('colorway_size_assets', constraints)

        querySnapshot.docs.forEach(doc => {
          const asset = doc.data() as FirestoreColorwaySizeAsset
          if (asset.sku) {
            this.colorwaySizeAssetsCache.set(asset.sku, asset)
          }
        })
      } catch (error) {
        console.error('batch fetch error:', error)
        throw error
      }
    }


    const copyOfCache = new Map<string, FirestoreColorwaySizeAsset>()
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
    const locations = await this.fetchMeasurementLocations()

    locations.forEach((location) => {
      this.measurementLocations.set(location.name, { name: location.garment_label, sort_order: location.sort_order })
    })
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

  private async watchForTryOnFrames(colorwaySizeAssetSKU: string, skipCache: boolean = false): Promise<TryOnFrames> {
    if (!this.IsLoggedIn) throw new UserNotLoggedInError()

    let firstSnapshotProcessed = false;

    const callback = async (data: QuerySnapshot<DocumentData>) => {
      if (skipCache && !firstSnapshotProcessed) {
        firstSnapshotProcessed = true;
        return false;
      }

      const frames = data.docs[0].data()?.vto?.[this.BrandID]?.[colorwaySizeAssetSKU]?.frames
      console.debug('awaitColorwaySizeAssetFrames callback, frames length:', frames?.length)
      if (!frames?.length) return false

      const tested = await testImage(frames[0])
      console.debug('awaitColorwaySizeAssetFrames testImage result:', tested)
      return tested
    }

    const userProfile = (await this.User.watchUserProfileForChanges(callback)) as FirestoreUser

    if (!userProfile?.vto?.[this.BrandID]?.[colorwaySizeAssetSKU]?.frames?.length) throw new NoFramesFoundError()

    this.vtoFramesCache.set(colorwaySizeAssetSKU, userProfile.vto[this.BrandID][colorwaySizeAssetSKU].frames)
    return userProfile.vto[this.BrandID][colorwaySizeAssetSKU].frames
  }

  private async requestColorwaySizeAssetFramesByID(colorwaySizeAssetId: number): Promise<void> {
    console.debug('requestColorwaySizeAssetFramesByID')
    if (!this.IsLoggedIn) throw new UserNotLoggedInError()

    await this.fetcher.Post(this.User, `/colorway-size-assets/${colorwaySizeAssetId}/frames`)
  }

  public async getCachedOrRequestUserColorwaySizeAssetFrames(colorwaySizeAssetSKU: string, skipCache: boolean): Promise<TryOnFrames | null> {
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

    const framesTyped = tryOnFrames as TryOnFrames
    this.vtoFramesCache.set(colorwaySizeAssetSKU, framesTyped)
    return framesTyped
  }
}
