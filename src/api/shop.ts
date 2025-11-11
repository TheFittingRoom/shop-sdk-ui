import { DocumentData, QueryFieldFilterConstraint, QuerySnapshot, where } from 'firebase/firestore'

import * as types from '.'
import { SizeFitRecommendation } from '../generated/api/responses'
import { Fetcher } from './fetcher'
import { Firebase } from './firebase/firebase'
import { getFirebaseError } from './firebase/firebase-error'
import { Config } from './helpers/config'
import * as Errors from './helpers/errors'
import { testImage } from './utils'

export class TFRShop {
  private measurementLocations: Map<string, { name: string; sort_order: number }> = new Map()

  constructor(
    private readonly brandId: number,
    private readonly firebase: Firebase,
  ) { }

  public get user() {
    return this.firebase.user
  }

  public get isLoggedIn(): boolean {
    return !this.firebase || Boolean(this.user.id)
  }

  public async onInit() {
    await this.getMeasurementLocations()

    return this.firebase.onInit(this.brandId)
  }

  public async getRecommendedSizes(styleId: number) {
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

  public async submitTelephoneNumber(tel: string) {
    const sanitizedTel = tel.replace(/[^+0-9]/g, '')
    const res = await Fetcher.Post(this.user, '/ios-app-link', { phone_number: sanitizedTel }, false)
    console.log(res)
  }

  public async getColorwaySizeAssetFromSku(colorwaySizeAssetSku: string): Promise<types.FirestoreColorwaySizeAsset> {
    const constraints: QueryFieldFilterConstraint[] = [
      where('brand_id', '==', this.brandId),
      where('sku', '==', colorwaySizeAssetSku),
    ]

    try {
      const querySnapshot = await this.firebase.getDocs('colorway_size_assets', constraints)

      if (querySnapshot.empty) {
        throw new Errors.NoColorwaySizeAssetsFoundError()
      }

      if (querySnapshot.size > 1) {
        throw new Error(
          `Multiple colorway size assets found for SKU: ${colorwaySizeAssetSku}. Expected exactly 1, found ${querySnapshot.size}.`,
        )
      }

      return querySnapshot.docs[0].data() as types.FirestoreColorwaySizeAsset
    } catch (error) {
      return getFirebaseError(error)
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

    const userProfile = this.isLoggedIn ? await this.user.getUserProfile() : null
    const gender = userProfile?.gender || 'female'
    const measurementLocations = styleGarmentCategory[
      `measurement_locations_${gender}` as keyof typeof styleGarmentCategory
    ] as string[]

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

  public async getStyleByBrandStyleId(brandStyleId: string) {
    try {
      const constraints: QueryFieldFilterConstraint[] = [where('brand_id', '==', this.brandId)]
      constraints.push(where('brand_style_id', '==', brandStyleId))
      const querySnapshot = await this.firebase.getDocs('styles', constraints)

      return querySnapshot.docs?.[0]?.data() as types.FirestoreStyle
    } catch (error) {
      return getFirebaseError(error)
    }
  }

  public async GetStyle(styleId: number) {
    try {
      const doc = await this.firebase.getDoc('styles', String(styleId))
      return doc as types.FirestoreStyle
    } catch (error) {
      return getFirebaseError(error)
    }
  }

  public getMeasurementLocationName(location: string) {
    return this.measurementLocations.has(location) ? this.measurementLocations.get(location).name : location
  }

  public getMeasurementLocationSortOrder(location: string) {
    return this.measurementLocations.has(location) ? this.measurementLocations.get(location).sort_order : Infinity
  }

  public async tryOn(sku: string) {
    if (!this.isLoggedIn) throw new Errors.UserNotLoggedInError()

    const colorwaySizeAsset = await this.getColorwaySizeAssetFromSku(sku)

    try {
      const frames = await this.getColorwaySizeAssetFrames(colorwaySizeAsset.sku)
      return frames
    } catch (error) {
      if (!(error instanceof Errors.NoFramesFoundError)) throw error
    }
    try {
      await this.requestColorwaySizeAssetFrames(colorwaySizeAsset.id)
    } catch (error) {
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

  public async GetStyleGarmentCategory(styleId: number) {
    try {
      const doc = await this.firebase.getDoc('style_garment_categories', String(styleId))

      return doc as types.FirestoreStyle
    } catch (error) {
      return getFirebaseError(error)
    }
  }

  public async GetStyleCategory(id: number) {
    try {
      const doc = await this.firebase.getDoc('style_categories', String(id))

      return doc as types.FirestoreStyle
    } catch (error) {
      return getFirebaseError(error)
    }
  }

  public async GetGarmentCategory(id: number) {
    try {
      const doc = await this.firebase.getDoc('garment_categories', String(id))

      return doc as any
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

  private async fetchMeasurementLocations(): Promise<types.FirestoreGarmentMeasurementLocation[]> {
    try {
      const docs = await this.firebase.getDocs('measurement_locations', [])

      return docs.docs.map((doc) => doc.data()) as types.FirestoreGarmentMeasurementLocation[]
    } catch (error) {
      throw getFirebaseError(error)
    }
  }

  private async awaitColorwaySizeAssetFrames(colorwaySizeAssetSKU: string) {
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

  private async requestColorwaySizeAssetFrames(colorwaySizeAssetId: number) {
    if (!this.isLoggedIn) throw new Errors.UserNotLoggedInError()
    if (!this.user.brandUserId) throw new Errors.BrandUserIdNotSetError()

    await Fetcher.Post(this.user, `/colorway-size-assets/${colorwaySizeAssetId}/frames`, {
      brand_user_id: String(this.user.brandUserId),
    })
  }

  private async getColorwaySizeAssetFrames(colorwaySizeAssetSKU: string) {
    const userProfile = await this.user.getUserProfile()

    const frames = userProfile?.vto?.[this.brandId]?.[colorwaySizeAssetSKU]?.frames || []
    if (!frames.length) throw new Errors.NoFramesFoundError()

    const testedImage = await testImage(frames[0])
    if (!testedImage) throw new Errors.NoFramesFoundError()

    return frames as types.TryOnFrames
  }
}

export const initShop = (brandId: number, env: string = 'dev') => {
  if (env === 'dev' || env === 'development') console.warn('TFRShop is in development mode')

  Config.getInstance().setEnv(env)

  return new TFRShop(brandId, new Firebase())
}
