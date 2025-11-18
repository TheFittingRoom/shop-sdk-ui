import * as firebase from 'firebase/app'
import {
  User,
  Auth,
  getAuth,
  browserLocalPersistence,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  confirmPasswordReset,
} from 'firebase/auth'

import * as Errors from '../errors'

export class FirebaseAuthUserController {
  private user: User | null = null // Initialize as null
  private initializationUserPromise: Promise<User | null>
  private readonly auth: Auth

  constructor(
    app: firebase.FirebaseApp,
  ) {
    this.auth = getAuth(app)
    this.auth.setPersistence(browserLocalPersistence)
    this.initializationUserPromise = this.initializeUser()
  }

  /**
   * Runs once on startup to determine the initial auth state.
   */
  private async initializeUser(): Promise<User | null> {
    const timeoutPromise = new Promise<null>((resolve) => {
      setTimeout(() => {
        console.debug('user auth callback timeout')
        resolve(null)
      }, 5000)
    })

    try {
      const authReadyPromise = this.auth.authStateReady().then(() => {
        return this.auth.currentUser
      })

      const result = await Promise.race([authReadyPromise, timeoutPromise])

      if (result) {
        this.user = result
      }
      return this.user
    } catch (error) {
      console.debug('authStateReady failed:', error)
      this.user = null
      this.initializationUserPromise = null
      return null
    }
  }

  public async GetUser(): Promise<User> {
    if (this.user) {
      return Promise.resolve(this.user)
    }
    const user = await this.initializationUserPromise
    if (!user) {
      throw new Errors.UserNotLoggedInError()
    }

    return this.user
  }

  public async GetToken(): Promise<string> {
    // The helper handles all auth checks and errors
    const user = await this.GetUser()
    return user.getIdToken()
  }

  public async Login(email: string, password: string): Promise<void> {
    if (this.auth.currentUser) {
      if (this.auth.currentUser.email == email) {
        console.debug("skipping logout since login email matches")
        return
      }
      await this.auth.signOut()
    }

    const userCred = await signInWithEmailAndPassword(this.auth, email, password)
    this.user = userCred.user

    this.initializationUserPromise = Promise.resolve(this.user)
  }

  public async Logout(): Promise<void> {
    await this.auth.signOut()
    this.user = null

    this.initializationUserPromise = this.initializeUser()
  }

  public async SendPasswordResetEmail(email: string): Promise<void> {
    await sendPasswordResetEmail(this.auth, email)
  }

  public async ConfirmPasswordReset(
    code: string,
    newPassword: string,
  ): Promise<void> {
    await confirmPasswordReset(this.auth, code, newPassword)
  }
}


