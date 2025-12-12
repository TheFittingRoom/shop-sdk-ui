import { DocumentData, QueryFieldFilterConstraint, where } from 'firebase/firestore'

import { ColorwaySizeAssetFrameURLs } from '.'
import {
  FirestoreColorwaySizeAsset,
  FirestoreGarmentCategory,
  FirestoreMeasurementLocation,
  FirestoreStyle,
  FirestoreStyleCategory,
  FirestoreStyleGarmentCategory,
  FirestoreUser,
  SizeFitRecommendation,
} from './gen/responses'
import { Config } from './helpers/config'
import {
  AvatarNotCreatedError,
  NoColorwaySizeAssetsFoundError,
  NoFramesFoundError,
  TimeoutError,
  UserNotLoggedInError,
} from './helpers/errors'
import { Fetcher } from './helpers/fetcher'
import { FirebaseAuthUserController } from './helpers/firebase/FirebaseAuthUserController'
import { FirestoreUserController } from './helpers/firebase/FirestoreUserController'
import { getFirebaseError } from './helpers/firebase/error'
import { FirestoreController } from './helpers/firebase/firestore'
import { testImage } from './helpers/utils'

export class FittingRoomAPI {
  public measurementLocations: Map<string, FirestoreMeasurementLocation> = new Map()
  private cachedColorwaySizeAssets: Map<string, FirestoreColorwaySizeAsset> = new Map()
  private vtoFramesPromiseCache: Map<string, Promise<ColorwaySizeAssetFrameURLs>> = new Map()
  private readonly fetcher: Fetcher

  constructor(
    public readonly BrandID: number,
    config: Config,
    private readonly firebase: FirestoreController,
    private readonly firebaseAuthUserController: FirebaseAuthUserController,
  ) {
    this.fetcher = new Fetcher(config)
  }

  public async IsLoggedIn(): Promise<boolean> {
    return Boolean(await this.firebaseAuthUserController.GetUserOrNotLoggedIn())
  }

  // public async GetUser(): Promise<User> {
  //   return await this.firebaseAuthUserController.GetUserOrNotLoggedIn()
  // }

  public async GetRecommendedSizes(styleId: number): Promise<SizeFitRecommendation | null> {
    if (!this.IsLoggedIn) throw UserNotLoggedInError
    console.debug('calling /recommend', styleId)
    try {
      const res = await this.fetcher.Get(this.firebaseAuthUserController, `/styles/${String(styleId)}/recommendation`)
      const sizeFitRecommendation = (await res.json()) as SizeFitRecommendation

      if (!sizeFitRecommendation?.fits?.length || !sizeFitRecommendation?.recommended_size?.id) return null
      console.debug('getRecommendedSizes', sizeFitRecommendation.available_sizes)
      return sizeFitRecommendation
    } catch (error) {
      if (error?.error === AvatarNotCreatedError) throw AvatarNotCreatedError

      throw error
    }
  }

  public async SubmitTelephoneNumber(tel: string): Promise<void> {
    const sanitizedTel = tel.replace(/[^+0-9]/g, '')
    const res = await this.fetcher.Post(
      this.firebaseAuthUserController,
      '/ios-app-link',
      { phone_number: sanitizedTel },
      false,
    )
    console.debug(res)
  }

  public async GetCachedColorwaySizeAssetFromSku(
    colorwaySizeAssetSku: string,
    skipCache: boolean,
  ): Promise<FirestoreColorwaySizeAsset> {
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
        throw NoColorwaySizeAssetsFoundError
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
      newAssets.forEach((asset) => {
        console.debug('caching colorway_size_asset', asset.sku)
        this.cachedColorwaySizeAssets.set(asset.sku, asset)
      })
    } catch (error) {
      getFirebaseError(error)
    }
  }

  public GetCachedColorwaySizeAssets(): FirestoreColorwaySizeAsset[] {
    let colorwaySizeAssets: FirestoreColorwaySizeAsset[] = []
    this.cachedColorwaySizeAssets.forEach((value) => {
      colorwaySizeAssets.push(value)
    })
    return colorwaySizeAssets
  }

  public async GetStyleByExernalID(externalID: string): Promise<FirestoreStyle | null> {
    if (!externalID) throw new Error('externalID is required for GetStyleByExernalID')
    await this.IsLoggedIn()
    try {
      const constraints: QueryFieldFilterConstraint[] = [where('brand_id', '==', this.BrandID)]
      constraints.push(where('external_id', '==', externalID))
      console.debug('Debug: Executing Firestore query with constraints:', {
        brand_id: this.BrandID,
        external_id: externalID
      })
      const querySnapshot = await this.firebase.getDocs('styles', constraints)
      console.debug('Debug: Firestore query result:', {
        size: querySnapshot.size,
        empty: querySnapshot.empty,
        externalID: externalID
      })
      const style = querySnapshot.docs?.[0]?.data() as FirestoreStyle
      console.debug('style fetched by brand id:', style)
      return style
    } catch (error) {
      console.debug('GetStyleByExernalID error:', externalID, error)
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

  // Helper method to fetch assets from Firestore
  public async FetchAndCacheColorwaySizeAssets(
    skus: string[],
    skipCache: boolean,
  ): Promise<Map<string, FirestoreColorwaySizeAsset>> {
    let uncachedSkus: string[] = []
    if (skipCache) {
      uncachedSkus = [...skus]
    } else {
      skus.forEach((sku) => {
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

        querySnapshot.docs.forEach((doc) => {
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

  // queues 3+ virtual try ons and only waits on the active rendered virtual tryon
  public async PriorityTryOnWithMultiRequestCache(
    firestoreUserController: FirestoreUserController,
    activeSKU: string,
    availableSKUs: string[],
    skipCache: boolean = false,
  ): Promise<ColorwaySizeAssetFrameURLs> {
    if (!activeSKU) throw new Error('activeSKU is required for PriorityTryOnWithMultiRequestCache')
    if (!availableSKUs) throw new Error('availableSKUs is required for PriorityTryOnWithMultiRequestCache')

    console.debug('PriorityTryOnWithMultiRequestCache', activeSKU, availableSKUs)
    if (!this.IsLoggedIn) throw UserNotLoggedInError

    const priorityPromise = this.GetCachedOrRequestUserColorwaySizeAssetFrames(
      firestoreUserController,
      activeSKU,
      skipCache,
    )

    const lowPrioritySkus = [...availableSKUs].filter((sku) => sku !== activeSKU)
    lowPrioritySkus.forEach((sku) => {
      this.GetCachedOrRequestUserColorwaySizeAssetFrames(firestoreUserController, sku, skipCache)
    })

    return await priorityPromise
  }

  private async requestColorwaySizeAssetFramesByID(colorwaySizeAssetId: number): Promise<void> {
    console.debug('requestColorwaySizeAssetFramesByID', colorwaySizeAssetId)
    if (!this.IsLoggedIn) throw UserNotLoggedInError

    await this.fetcher.Post(this.firebaseAuthUserController, `/colorway-size-assets/${colorwaySizeAssetId}/frames`)
  }

  private getVTOFramesFromUser(
    firestoreUser: FirestoreUser,
    colorwaySizeAssetSKU: string
  ): ColorwaySizeAssetFrameURLs | undefined {
    console.debug('getVTOFramesFromUser', colorwaySizeAssetSKU)
    return firestoreUser.vto?.[this.BrandID]?.[colorwaySizeAssetSKU]?.frames as ColorwaySizeAssetFrameURLs | undefined;
  }

  private watchForFramesSnapshotCallback(skipFullSnapshot: boolean, colorwaySizeAssetSKU: string): (data: DocumentData) => Promise<boolean> {
    let firstSnapshotProcessed = false
    return async (data: DocumentData): Promise<boolean> => {
      if (skipFullSnapshot && !firstSnapshotProcessed) {
        console.debug('skipping first snapshot', colorwaySizeAssetSKU)
        firstSnapshotProcessed = true
        return false
      }

      console.debug('checking user for vto frames', colorwaySizeAssetSKU)

      const firestoreUser = data as FirestoreUser
      const colorwaySizeAssetEntry = firestoreUser.vto?.[this.BrandID]?.[colorwaySizeAssetSKU]
      if (!colorwaySizeAssetEntry) {
        console.debug('no vto entry for SKU, continue watching:', colorwaySizeAssetSKU)
        return false
      }
      if (colorwaySizeAssetEntry.error) {
        console.error('VTO error found for SKU:', colorwaySizeAssetSKU, colorwaySizeAssetEntry.error)
        throw NoFramesFoundError
      }

      console.debug("cololrwaySizeAssetEntry", colorwaySizeAssetEntry)

      const frames = this.getVTOFramesFromUser(firestoreUser, colorwaySizeAssetSKU)
      if (!frames?.length) {
        throw NoFramesFoundError
      }

      console.debug('testing first frame for SKU:', colorwaySizeAssetSKU, frames[0])
      const tested = await testImage(frames[0])
      if (!tested) {
        console.error('image test failed for SKU:', colorwaySizeAssetSKU)
        throw NoFramesFoundError
      }

      return true
    }
  }

  private async watchForTryOnFrames(
    firestoreUserController: FirestoreUserController,
    colorwaySizeAssetSKU: string,
    skipFullSnapshot: boolean,
  ): Promise<ColorwaySizeAssetFrameURLs> {
    console.debug('WatchForTryOnFrames', colorwaySizeAssetSKU, 'skipFullSnapshot:', skipFullSnapshot);
    if (!this.IsLoggedIn) throw UserNotLoggedInError

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(TimeoutError)
      }, 300000)
    })

    let firestoreUser: FirestoreUser
    try {
      const watchPromise = firestoreUserController.WatchFirestoreUserChange(this.watchForFramesSnapshotCallback(skipFullSnapshot, colorwaySizeAssetSKU))

      firestoreUser = await Promise.race([watchPromise, timeoutPromise])

    } catch (error) {
      if (error == TimeoutError) {
        console.error(error)
        throw TimeoutError
      }

      if (error == NoFramesFoundError) {
        throw error
      }

      console.error(`Error watching for try-on frames for SKU: ${colorwaySizeAssetSKU}`, error)
      throw error
    }

    const frames = this.getVTOFramesFromUser(firestoreUser, colorwaySizeAssetSKU)
    if (!frames) {
      console.error(`Frames not found on final user object for SKU: ${colorwaySizeAssetSKU}`, firestoreUser)
      throw NoFramesFoundError
    }
    return frames
  }

  public async GetCachedOrRequestUserColorwaySizeAssetFrames(
    firestoreUserController: FirestoreUserController,
    colorwaySizeAssetSKU: string,
    skipCache: boolean,
  ): Promise<ColorwaySizeAssetFrameURLs | null> {
    console.debug('GetCachedOrRequestUserColorwaySizeAssetFrames', colorwaySizeAssetSKU, 'skipCache:', skipCache);

    if (!skipCache) {
      const cached = this.vtoFramesPromiseCache.get(colorwaySizeAssetSKU);
      if (cached) {
        console.debug('returning cached frames', colorwaySizeAssetSKU);
        return await cached;
      }
    }

    const colorwaySizeAsset = this.cachedColorwaySizeAssets.get(colorwaySizeAssetSKU);
    if (!colorwaySizeAsset) {
      console.error('colorwaySizeAssetSKU not in cache', colorwaySizeAssetSKU);
      throw new Error(`colorwaySizeAsset not found ${colorwaySizeAssetSKU}`);
    }
    const colorwaySizeAssetID = colorwaySizeAsset.id;

    let framesPromise: Promise<ColorwaySizeAssetFrameURLs>;
    try {
      let skipFullSnapshot = false;
      if (skipCache) {
        console.debug('skipping cache, requesting fresh frames');
        await this.requestColorwaySizeAssetFramesByID(colorwaySizeAssetID);
        skipFullSnapshot = true
      }
      framesPromise = this.watchForTryOnFrames(firestoreUserController, colorwaySizeAssetSKU, skipFullSnapshot);
      await framesPromise;
    } catch (error) {
      if (error != NoFramesFoundError) {
        throw error;
      }
      console.debug(`No frames found for SKU: ${colorwaySizeAssetSKU}, attempting to request fresh frames`);
      await this.requestColorwaySizeAssetFramesByID(colorwaySizeAssetID);
      console.debug('waiting for new vto after refresh request');
      framesPromise = this.watchForTryOnFrames(firestoreUserController, colorwaySizeAssetSKU, true);
    }
    this.vtoFramesPromiseCache.set(colorwaySizeAssetSKU, framesPromise);

    return await framesPromise
  }
}
