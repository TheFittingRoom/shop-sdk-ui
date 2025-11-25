import * as firebase from 'firebase/app'
import {
  User,
  Auth,
  getAuth,
  browserLocalPersistence,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  confirmPasswordReset,
  onAuthStateChanged,
} from 'firebase/auth'

import * as Errors from '../errors'

export class FirebaseAuthUserController {
  private readonly initializationPromise: Promise<User | null>
  private unsubscribeAuthStateChanged: (() => void) | null = null
  private readonly auth: Auth

  constructor(
    app: firebase.FirebaseApp,
  ) {
    this.auth = getAuth(app)
    this.auth.setPersistence(browserLocalPersistence)
    this.initializationPromise = this.setupAuthStateListener()
  }

  /**
   * Sets up the auth state change listener to track initialization.
   * Returns a promise that resolves with the user once the initial state is known.
   */
  private setupAuthStateListener(): Promise<User | null> {
    return new Promise<User | null>((resolve) => {
      this.unsubscribeAuthStateChanged = onAuthStateChanged(
        this.auth,
        (user) => {
          resolve(user)
        },
        (error) => {
          console.error('Auth state listener error:', error)
          // Resolve with null to ensure initialization always completes
          resolve(null)
        },
      )
    })
  }

  /**
   * Waits for the auth state to be initialized
   */
  private waitForInitialization(): Promise<User | null> {
    return this.initializationPromise
  }

  public async GetUserOrNotLoggedIn(): Promise<User> {
    const user = await this.waitForInitialization()

    if (!user) {
      throw new Errors.UserNotLoggedInError()
    }

    return user
  }

  public async GetToken(): Promise<string> {
    const user = await this.GetUserOrNotLoggedIn()
    // Force token refresh to ensure it's current
    return user.getIdToken(true)
  }

  public async GetCurrentUser(): Promise<User | null> {
    return this.waitForInitialization()
  }

  public async Login(email: string, password: string): Promise<void> {
    // Check if already logged in with same email
    if (this.auth.currentUser && this.auth.currentUser.email === email) {
      console.debug("Skipping login since user is already logged in with same email")
      return
    }

    // Sign out existing user if different email
    if (this.auth.currentUser && this.auth.currentUser.email !== email) {
      await this.auth.signOut()
    }

    try {
      const userCredential = await signInWithEmailAndPassword(this.auth, email, password)
      console.debug("Login successful for user:", userCredential.user.email)
    } catch (error) {
      console.error("Login error:", error)
      throw error
    }
  }

  public async Logout(): Promise<void> {
    try {
      await this.auth.signOut()
      console.debug("Logout successful")
    } catch (error) {
      console.error("Logout error:", error)
      throw error
    }
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

  /**
   * Cleans up the auth state listener to prevent memory leaks
   */
  public cleanup(): void {
    if (this.unsubscribeAuthStateChanged) {
      this.unsubscribeAuthStateChanged()
      this.unsubscribeAuthStateChanged = null
    }
  }
}


