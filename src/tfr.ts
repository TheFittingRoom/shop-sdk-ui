import { FirestoreStyle, TryOnFrames, FirestoreColorwaySizeAsset, FirestoreUser } from './api'
/// <reference types="vite/client" />

import { VTOController } from './components/VirtualTryOnController'
import { L } from './components/locale'
import { validateEmail, validatePassword } from './helpers/validations'
import { TFRModal } from './components/ModalController'
import { SizeRecommendationController, TFRCssVariables } from './components/SizeRecommendationController'
import { FittingRoomAPI } from './api/api'
import { Config } from './api/helpers/config'
import { FirebaseAuthUserController } from './api/helpers/firebase/FirebaseAuthUserController'
import { FirestoreUserController } from './api/helpers/firebase/FirestoreUserController'
import { FirestoreController } from './api/helpers/firebase/firestore'
import { UserNotLoggedInError } from './api/helpers/errors'
import { AvatarStatusCreated, AvatarStatusPending, AvatarStatusNotCreated, AvatarStatus } from './api/gen/enums'
import { Avatar, GarmentMeasurement } from './api/gen/responses'

export interface TFRHooks {
  onLoading?: () => void
  onLoadingComplete?: () => void
  onError?: (error: string) => void
  onVtoReady?: (frames: TryOnFrames) => void
  onLogin?: () => void
  onLogout?: () => void
}

export class FittingRoomController {
  private hasInitializedTryOn: boolean = false
  private forceFreshVTO: boolean = false

  public style: FirestoreStyle
  public colorwaySizeAsset: FirestoreColorwaySizeAsset
  private config: Config

  public readonly tfrModal: TFRModal
  public readonly SizeRecommendationController: SizeRecommendationController
  private readonly vtoComponent: VTOController
  private readonly firestoreController: FirestoreController
  private firebaseAuthUserController: FirebaseAuthUserController
  private firestoreUserController: FirestoreUserController
  private readonly API: FittingRoomAPI
  private unsubFirestoreUserCollection: () => void = null

  constructor(
    env: string,
    private readonly shopID: number,
    private readonly styleSKU: string,
    private readonly noCacheOnRetry: boolean = false,
    modalDivId: string,
    sizeRecMainDivId: string,
    vtoMainDivId: string,
    cssVariables?: TFRCssVariables,
    private readonly hooks: TFRHooks = {},
  ) {
    const modalDiv = document.getElementById(modalDivId) as HTMLDivElement
    const sizeRecMainDiv = document.getElementById(sizeRecMainDivId) as HTMLDivElement
    const vtoMainDiv = document.getElementById(vtoMainDivId) as HTMLDivElement
    if (!modalDiv || !sizeRecMainDiv || !vtoMainDiv) {
      console.error(modalDiv, sizeRecMainDiv, vtoMainDiv)
      throw new Error(
        'The Fitting Room essential div id is missing',
      )
    }

    this.config = new Config(env)

    this.tfrModal = new TFRModal(
      modalDiv,
      this.signInClickModalCallback.bind(this),
      this.forgotPassword.bind(this),
      this.submitTel.bind(this),
    )
    this.firestoreController = new FirestoreController(this.config)
    this.firebaseAuthUserController = new FirebaseAuthUserController(this.firestoreController.firestore.app)
    this.API = new FittingRoomAPI(this.shopID, this.config, this.firestoreController)

    if (vtoMainDivId) this.vtoComponent = new VTOController(vtoMainDiv)

    this.SizeRecommendationController = new SizeRecommendationController(
      sizeRecMainDiv,
      cssVariables || {},
      this.API,
      this.onSignInSizeRecommendationCallback.bind(this),
      this.onLogOutCallback.bind(this),
      this.onFitInfoCallback.bind(this),
      this.onTryOnCallback.bind(this),
    )

    // TODO: write a callback function that gets passed to the API state handlerss
    // this.API.onAuthStateChange((isLoggedIn) => {
    //   console.debug('Firebase auth state changed to:', isLoggedIn, 'updating UI')
    //   this.isLoggedIn = isLoggedIn
    //   this.tfrSizeRecommendationController.setIsLoggedIn(isLoggedIn)
    // })
  }

  public async Init(): Promise<void> {
    try {
      const measurementLocationsPromise = this.API.FetchCacheMeasurementLocations()
      const authUserPromise = this.firebaseAuthUserController.GetUserOrNotLoggedIn()
      const stylePromise = this.API.GetStyleByBrandStyleID(this.styleSKU)
      await Promise.all([
        authUserPromise,
        stylePromise,
        measurementLocationsPromise,
      ])
      console.debug("promise all ready")

      let cacheColorwaySizeAssetsPromise: Promise<void> = null
      const style = await stylePromise
      if (style) {
        this.style = style
        cacheColorwaySizeAssetsPromise = this.API.FetchColorwaySizeAssetsFromStyleId(style.id)

        console.debug("is_published", this.style.is_published)
        if (!this.style.is_published) {
          this.SizeRecommendationController.Hide()
        }

        console.debug("is_vto", this.style.is_vto)
        if (this.style.is_vto) {
          this.SizeRecommendationController.ShowTryOnButton()
        }
      }
      const styleMeasurementLocations = this.styleToGarmentMeasurementLocations(this.style)

      const authUser = await authUserPromise
      if (authUser) {
        //init and prefetch user
        this.firestoreUserController = new FirestoreUserController(
          this.firestoreController,
          this.firebaseAuthUserController)
      }

      if (cacheColorwaySizeAssetsPromise) {
        // let cache finish before loading
        await cacheColorwaySizeAssetsPromise
      }

      if (Boolean(authUser)) {
        this.SizeRecommendationController.ShowLoggedIn()
        this.SizeRecommendationController.Show()
        if (this.hooks?.onLogin) this.hooks.onLogin()
        // For logged-in users, start the size recommendation UI
        if (this.style) {
          console.log("calling StartSizeRecommendation from Init method for logged in user")
          this.SizeRecommendationController.GetSizeRecommendationByStyleID(this.style.id, this.API.GetCachedColorwaySizeAssets())
        } else {
        }
      } else {
        console.log("calling setLoggedOutStyleMeasurementLocations from Init method")
        this.SizeRecommendationController.setLoggedOutStyleMeasurementLocations(styleMeasurementLocations)
      }
    } catch (e) {
      console.debug("Init caught error:", e)
      if (e instanceof UserNotLoggedInError) {
        console.debug("No user logged in during init")
        return
      }
      throw e
    }
  }

  public async SizeRecommendationBySKU(activeSku: string, skipCache: boolean = false) {
    console.debug("StartSizeRecommendation", activeSku, skipCache)
    let colorwaySizeAsset = await this.API.GetCachedColorwaySizeAssetFromSku(activeSku, skipCache)
    if (this.style && this.style.id == colorwaySizeAsset.style_id && !skipCache) {
      console.debug("style and size_recommendation is precached")
    } else {
      console.debug('fetching style for sku:', activeSku)
      this.style = await this.API.GetStyleByID(colorwaySizeAsset.style_id)
    }

    if (!this.style) {
      this.SizeRecommendationController.Hide()
    }

    console.debug("is_published", this.style.is_published)
    if (!this.style.is_published) {
      this.SizeRecommendationController.Hide()
    }

    console.debug("is_vto", this.style.is_vto)
    if (this.style.is_vto) {
      this.SizeRecommendationController.ShowTryOnButton()
    }

    try {
      await this.firebaseAuthUserController.GetUserOrNotLoggedIn()
      this.SizeRecommendationController.GetSizeRecommendationByStyleID(this.style.id, this.API.GetCachedColorwaySizeAssets(), colorwaySizeAsset.colorway_id)
    } catch (e) {
      if (!(e instanceof UserNotLoggedInError)) {
        throw e
      }
      const styleMeasurementLocations = this.styleToGarmentMeasurementLocations(this.style)
      console.log("calling setLoggedOutStyleMeasurementLocations from GetSizeRecommendation catch block")
      this.SizeRecommendationController.setLoggedOutStyleMeasurementLocations(styleMeasurementLocations)
    }
  }

  public close() {
    this.tfrModal.close()
  }

  public async onLogOutCallback() {
    await this.firebaseAuthUserController.Logout()

    if (this.hooks?.onLogout) this.hooks.onLogout()

    console.log("calling setLoggedOutStyleMeasurementLocations from logOutCallback")
    this.SizeRecommendationController.setLoggedOutStyleMeasurementLocations(this.styleToGarmentMeasurementLocations(this.style))
    this.unsubscribeFromProfileChanges()
  }

  public async signInClickModalCallback(username: string, password: string, validationError: (message: string) => void) {
    if (username.length == 0 || password.length == 0) return validationError(L.UsernameOrPasswordEmpty)
    if (!validateEmail(username)) return validationError(L.EmailError)
    if (!validatePassword(password)) return validationError(L.PasswordError)

    try {
      await this.firebaseAuthUserController.Login(username, password)

      // Initialize FirestoreUserController if not already done
      if (!this.firestoreUserController) {
        this.firestoreUserController = new FirestoreUserController(
          this.firestoreController,
          this.firebaseAuthUserController)
      }

      await this.firestoreUserController.WriteUserLogging(this.shopID)

      this.tfrModal.close()
      if (this.hooks?.onLogin) this.hooks.onLogin()

      if (this.style) {
        console.log("calling StartSizeRecommendation after successful login")
        this.SizeRecommendationController.GetSizeRecommendationByStyleID(this.style.id, this.API.GetCachedColorwaySizeAssets())
      }

      const user = await this.firestoreUserController.GetUser(false)
      this.updateAvatarStatus(user)

      this.firestoreUserController.WatchFirestoreUserChange(this.avatarStatusChangeCallback)
    } catch (e) {
      return validationError(L.UsernameOrPasswordIncorrect)
    }
  }

  public async submitTel(tel: string) {
    try {
      await this.API.SubmitTelephoneNumber(tel)
      this.tfrModal.toSignIn()
    } catch {
      this.tfrModal.onError(L.SomethingWentWrong)
    }
  }

  public async forgotPassword(email: string) {
    await this.firebaseAuthUserController.SendPasswordResetEmail(email)

    this.tfrModal.toSignIn()
  }

  public async passwordReset(code: string, newPassword: string) {
    await this.firebaseAuthUserController.ConfirmPasswordReset(code, newPassword)

    this.tfrModal.toPasswordReset()
  }

  public async getMeasurementLocations(skipCache: boolean) {
    const user = await this.firestoreUserController.GetUser(skipCache)
    return this.API.GetMeasurementLocations(user)
  }

  public onSignInSizeRecommendationCallback() {
    this.tfrModal.toScan()
  }

  public onFitInfoCallback() {
    this.tfrModal.toFitInfo()
  }

  // callback for SizeRecommendationController
  public async onTryOnCallback(primarySKU: string, availableSKUs: string[]) {
    console.log("tryOncallback", primarySKU, availableSKUs)
    this.forceFreshVTO = this.hasInitializedTryOn && this.noCacheOnRetry

    try {
      const batchResult = await this.API.PriorityTryOnWithMultiRequestCache(this.firestoreUserController, primarySKU, availableSKUs, this.forceFreshVTO)
      this.vtoComponent.onNewFramesReady(batchResult)
      console.log("calling HideVTOLoading after successful VTO")
      this.SizeRecommendationController.SetVTOLoading(true)
      this.hasInitializedTryOn = true
    } catch (e) {
      this.tfrModal.onError(L.SomethingWentWrong)
      console.log("calling HideVTOLoading after VTO error")
      this.SizeRecommendationController.SetVTOLoading(false)
      console.error(e)
    }
  }


  // if the avatar state loaded from the initial new FirestoreUserController is NOT_CREATED use this listener
  private async avatarStatusChangeCallback(user: FirestoreUser): Promise<boolean> {
    console.debug('onAvatarStateChange', user.avatar_status)
    switch (user.avatar_status as AvatarStatus) {
      case AvatarStatusNotCreated:
        this.updateAvatarStatus(user)
        return false

      case AvatarStatusPending:
        this.updateAvatarStatus(user)
        return false

      case AvatarStatusCreated:
        this.updateAvatarStatus(user)
        return false

      default:
        // if (this.hooks?.onError) this.hooks.onError(L.SomethingWentWrong)
        return true
    }
  }

  private updateAvatarStatus(userProfile: FirestoreUser) {
    switch (userProfile.avatar_status as AvatarStatus) {
      case AvatarStatusNotCreated:
        this.tfrModal.onNotCreated()
        break
      case AvatarStatusPending:
        if (this.hooks?.onLoading) this.hooks.onLoading()
        console.log("calling DisableTryOnButton - avatar not ready")
        this.SizeRecommendationController.DisableTryOnButton('Your avatar is not ready yet')
        break
      case AvatarStatusCreated:
        if (this.hooks?.onLoadingComplete) this.hooks.onLoadingComplete()
        console.log("calling EnableTryOnButton - avatar ready")
        this.SizeRecommendationController.EnableTryOnButton()
        break
      default:
        console.log("calling DisableTryOnButton - fitting room unavailable")
        this.SizeRecommendationController.DisableTryOnButton('The Fitting Room is currently unavailable.')
        throw new Error("no avatar status")
    }
  }

  private unsubscribeFromProfileChanges() {
    if (!this.unsubFirestoreUserCollection) return;

    this.unsubFirestoreUserCollection();
    this.unsubFirestoreUserCollection = null;
  }

  public styleToGarmentMeasurementLocations(style: FirestoreStyle): GarmentMeasurement[] {
    return style.sizes[0].garment_measurements
  }

}
