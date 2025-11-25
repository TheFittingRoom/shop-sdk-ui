import { DocumentData, QueryFieldFilterConstraint, where } from 'firebase/firestore'

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
import { FirestoreController } from './helpers/firebase/firestore'
import { getFirebaseError } from './helpers/firebase/error'
import { TryOnFrames as ColorwaySizeAssetFrameURLs, TryOnFrames } from '.'
import { AvatarNotCreatedError, NoColorwaySizeAssetsFoundError, NoFramesFoundError, TimeoutError, UserNotLoggedInError } from './helpers/errors'

import { Config } from './helpers/config'
import { FirebaseAuthUserController } from './helpers/firebase/FirebaseAuthUserController'
import { User } from 'firebase/auth'
import { testImage } from './helpers/utils'
import { FirestoreUserController } from './helpers/firebase/FirestoreUserController'

export class FittingRoomAPI {
  private measurementLocations: Map<string, { name: string; sort_order: number }> = new Map()
  private cachedColorwaySizeAssets: Map<string, FirestoreColorwaySizeAsset> = new Map()
  private vtoFramesCache: Map<string, ColorwaySizeAssetFrameURLs> = new Map()
  private readonly fetcher: Fetcher
  private style: FirestoreStyle
  private firebaseAuthUserController: FirebaseAuthUserController

  constructor(
    public readonly BrandID: number,
    config: Config,
    private readonly firebase: FirestoreController
  ) {
    this.fetcher = new Fetcher(config)
    this.firebaseAuthUserController = new FirebaseAuthUserController(this.firebase.firestore.app)
  }

  public async IsLoggedIn(): Promise<boolean> {
    return Boolean(await this.firebaseAuthUserController.GetUserOrNotLoggedIn())
  }

  public async GetUser(): Promise<User> {
    return await this.firebaseAuthUserController.GetUserOrNotLoggedIn()
  }

  public async GetRecommendedSizes(styleId: number): Promise<SizeFitRecommendation | null> {
    if (!this.IsLoggedIn) throw new UserNotLoggedInError()
    console.debug('calling /recommend', styleId)
    try {
      const res = await this.fetcher.Get(this.firebaseAuthUserController, `/styles/${String(styleId)}/recommendation`)
      const data = (await res.json()) as SizeFitRecommendation

      if (!data?.fits?.length || !data?.recommended_size?.id) return null
      console.debug('getRecommendedSizes', data.available_sizes)
      return data
    } catch (error) {
      if (error?.error === AvatarNotCreatedError) throw new AvatarNotCreatedError()

      throw error
    }
  }

  public async SubmitTelephoneNumber(tel: string): Promise<void> {
    const sanitizedTel = tel.replace(/[^+0-9]/g, '')
    const res = await this.fetcher.Post(this.firebaseAuthUserController, '/ios-app-link', { phone_number: sanitizedTel }, false)
    console.debug(res)
  }

  public async GetCachedColorwaySizeAssetFromSku(colorwaySizeAssetSku: string, skipCache: boolean): Promise<FirestoreColorwaySizeAsset> {
    if (!skipCache) {
      const cachedAsset = this.cachedColorwaySizeAssets.get(colorwaySizeAssetSku)
      if (cachedAsset) {
        console.debug('using cached colorwaySizeAsset for sku:', colorwaySizeAssetSku)
        return cachedAsset
      }
    }

    console.debug('using firestore colorwaySizeAsset for sku:', colorwaySizeAssetSku)

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
      const colorwaySizeAsset = querySnapshot.docs[0].data() as FirestoreColorwaySizeAsset
      this.cachedColorwaySizeAssets.set(colorwaySizeAssetSku, colorwaySizeAsset)
      return colorwaySizeAsset
    } catch (error) {
      console.debug('getColorwayAsset error:', colorwaySizeAssetSku, error.message)
      throw error
    }
  }

  public async FetchColorwaySizeAssetsFromStyleId(styleId: number): Promise<void> {
    console.debug('fetching colorway_size_assets', 'styleId', styleId)
    const constraints: QueryFieldFilterConstraint[] = [
      where('brand_id', '==', this.BrandID),
      where('style_id', '==', styleId),
    ]
    try {
      const querySnapshot = await this.firebase.getDocs('colorway_size_assets', constraints)
      const newAssets = querySnapshot.docs.map((doc) => doc.data() as FirestoreColorwaySizeAsset)
      newAssets.forEach(asset => {
        console.debug("caching colorway_size_asset", asset.sku)
        this.cachedColorwaySizeAssets.set(asset.sku, asset)
      })
    } catch (error) {
      getFirebaseError(error)
    }
  }

  public GetCachedColorwaySizeAssets(): FirestoreColorwaySizeAsset[] {
    let colorwaySizeAssets: FirestoreColorwaySizeAsset[] = [];
    this.cachedColorwaySizeAssets.forEach((value) => {
      colorwaySizeAssets.push(value)
    })
    return colorwaySizeAssets
  }

  public async GetMeasurementLocationsFromSku(sku: string, filledLocations: string[] = [], skipCache: boolean): Promise<string[]> {
    const colorwaySizeAsset = await this.GetCachedColorwaySizeAssetFromSku(sku, skipCache)
    if (!colorwaySizeAsset) throw new Error('No colorway size asset found for sku')

    const styleGarmentCategory = await this.GetStyleGarmentCategory(this.style.id)
    if (!styleGarmentCategory) throw new Error('Taxonomy not found for style garment category id')

    // const userProfile = this.IsLoggedIn ? await this.firestoreUserController.FetchUser(false) : null
    const gender = 'female' //TODO add gender to go api firestore response

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
    if (!styleSKU) throw new Error('styleSKU is required for GetStyleByBrandStyleID')
    const isLoggedIn = await this.IsLoggedIn()
    console.debug("isLoggedIn", isLoggedIn, 'BrandID:', this.BrandID)
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
        if (!this.cachedColorwaySizeAssets.has(sku)) {
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
            this.cachedColorwaySizeAssets.set(asset.sku, asset)
          }
        })
      } catch (error) {
        console.error('batch fetch error:', error)
        throw error
      }
    }


    const copyOfCache = new Map<string, FirestoreColorwaySizeAsset>()
    for (const sku of skus) {
      const asset = this.cachedColorwaySizeAssets.get(sku)
      if (asset) {
        copyOfCache.set(sku, asset)
      } else {
        console.error(`no colorway asset found for SKU: ${sku}`)
      }
    }
    return this.cachedColorwaySizeAssets
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

  public async FetchCacheMeasurementLocations(): Promise<void> {
    console.debug('getMeasurementLocations')
    const locations = await this.FetchMeasurementLocations()

    locations.forEach((location) => {
      this.measurementLocations.set(location.name, { name: location.garment_label, sort_order: location.sort_order })
    })
  }

  private async FetchMeasurementLocations(): Promise<FirestoreMeasurementLocation[]> {
    console.debug('fetchMeasurementLocations')
    try {
      const docs = await this.firebase.getDocs('measurement_locations', [])

      return docs.docs.map((doc) => doc.data()) as FirestoreMeasurementLocation[]
    } catch (error) {
      throw getFirebaseError(error)
    }
  }

  // queues 3+ virtual try ons and only waits on the active rendered virtual tryon
  public async PriorityTryOnWithMultiRequestCache(firestoreUserController: FirestoreUserController, activeSKU: string, availableSKUs: string[], skipCache: boolean = false): Promise<TryOnFrames> {
    console.debug("PriorityTryOnWithMultiRequestCache", activeSKU, availableSKUs)
    if (!this.IsLoggedIn) throw new UserNotLoggedInError()

    const priorityPromise = this.GetCachedOrRequestUserColorwaySizeAssetFrames(firestoreUserController, activeSKU, skipCache)

    const lowPrioritySkus = [...availableSKUs].filter(sku => sku !== activeSKU)
    lowPrioritySkus.forEach(sku => {
      // frames will be cached in the background
      this.GetCachedOrRequestUserColorwaySizeAssetFrames(firestoreUserController, sku, skipCache)
    })

    return await priorityPromise
  }

  private async requestColorwaySizeAssetFramesByID(colorwaySizeAssetId: number): Promise<void> {
    console.debug('requestColorwaySizeAssetFramesByID', colorwaySizeAssetId)
    if (!this.IsLoggedIn) throw new UserNotLoggedInError()

    await this.fetcher.Post(this.firebaseAuthUserController, `/colorway-size-assets/${colorwaySizeAssetId}/frames`)
  }

  private async WatchForTryOnFrames(firestoreUserController: FirestoreUserController, colorwaySizeAssetSKU: string, skipFullSnapshot: boolean = false): Promise<TryOnFrames> {
    if (!this.IsLoggedIn) throw new UserNotLoggedInError()

    let firstSnapshotProcessed = false;

    const firestoreUserWatchCallback = async (data: DocumentData) => {
      console.debug("firestoreUserWatchCallback", data)
      if (skipFullSnapshot && !firstSnapshotProcessed) {
        firstSnapshotProcessed = true;
        return false;
      }

      // get the frames from a cached or fresh user profile
      try {
        const firestoreUser = data as FirestoreUser
        const frames = firestoreUser.vto[this.BrandID][colorwaySizeAssetSKU].frames
        if (!frames?.length) {
          return false // we recieved an invalid firestore change
        }
        const tested = await testImage(frames[0])
        if (!tested) {
          throw new NoFramesFoundError()
        }
        return true
      } catch (e) {
        console.debug("failed to resolve colorway_size_asset_frames from firestore_user snapshot", e)
        // Only continue watching for certain types of errors
        // If it's a NoFramesFoundError, we should stop watching and let the error propagate
        if (e instanceof NoFramesFoundError) {
          throw e  // Re-throw so it gets handled by WatchFirestoreUserChange
        }
        return false  // Continue watching for other types of errors
      }
    }

    // Create a timeout promise that will reject after 300 seconds
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new TimeoutError(`Timeout waiting for try-on frames for SKU: ${colorwaySizeAssetSKU} after 300 seconds`))
      }, 300000) // 300 seconds = 300,000 milliseconds
    })

    // Race between the Firestore watch and the timeout
    let firestoreUser: FirestoreUser;
    try {
      // Create the watch promise
      const watchPromise = firestoreUserController.WatchFirestoreUserChange(firestoreUserWatchCallback)

      // Use Promise.race to implement timeout
      firestoreUser = await Promise.race([watchPromise, timeoutPromise])
    } catch (error) {
      // If it's a timeout error, provide a more specific message
      if (error instanceof TimeoutError) {
        console.error(error.message)
        throw new TimeoutError(`Timed out waiting for virtual try-on frames. Process cancelled after 300 seconds for SKU: ${colorwaySizeAssetSKU}`)
      }

      if (error instanceof NoFramesFoundError) {
        console.debug(`No frames found for SKU: ${colorwaySizeAssetSKU}`)
        throw error
      }
      console.error(`Error watching for try-on frames for SKU: ${colorwaySizeAssetSKU}`, error)
      throw error
    }

    const frames = firestoreUser.vto[this.BrandID][colorwaySizeAssetSKU].frames
    this.vtoFramesCache.set(colorwaySizeAssetSKU, frames)
    return frames
  }

  public async GetCachedOrRequestUserColorwaySizeAssetFrames(firestoreUserController: FirestoreUserController, colorwaySizeAssetSKU: string, skipCache: boolean): Promise<TryOnFrames | null> {
    console.debug('fetchUserVTOFrames', colorwaySizeAssetSKU, 'skipCache:', skipCache)
    if (!skipCache) {
      const cached = this.vtoFramesCache.get(colorwaySizeAssetSKU)
      if (cached) {
        console.debug('returning cached frames', colorwaySizeAssetSKU)
        return cached
      }
    }
    let frames: TryOnFrames

    // Get the colorway size asset ID upfront
    const colorwaySizeAssetID = this.cachedColorwaySizeAssets.get(colorwaySizeAssetSKU).id
    if (!colorwaySizeAssetID) {
      throw new Error(`colorwaySizeAssetID wasnt in cache ${colorwaySizeAssetSKU} ${colorwaySizeAssetID}`)
    }

    if (!skipCache) {
      // grab the full snapshot
      console.debug("waiting for full snapshot")
      try {
        frames = await this.WatchForTryOnFrames(firestoreUserController, colorwaySizeAssetSKU, false)
      } catch (error) {
        // If we get a NoFramesFoundError when not skipping cache, try to request fresh frames
        if (error instanceof NoFramesFoundError) {
          console.debug(`No frames found for SKU: ${colorwaySizeAssetSKU}, attempting to request fresh frames`)

          await this.requestColorwaySizeAssetFramesByID(colorwaySizeAssetID)

          // Try again with skipCache=true behavior (watch for diff snapshot)
          console.debug("waiting for new vto after refresh request")
          frames = await this.WatchForTryOnFrames(firestoreUserController, colorwaySizeAssetSKU, true)
        } else {
          throw error
        }
      }
    } else {
      // make a new vto request and wait for diff snapshot
      await this.requestColorwaySizeAssetFramesByID(colorwaySizeAssetID)

      console.debug("waiting for new vto")
      frames = await this.WatchForTryOnFrames(firestoreUserController, colorwaySizeAssetSKU, true)
    }

    console.debug("retrieved frames", frames)
    this.vtoFramesCache.set(colorwaySizeAssetSKU, frames)
    return frames
  }
}
