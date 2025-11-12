import dayjs from 'dayjs/esm'
import * as firebase from 'firebase/app'
import * as firebaseAuth from 'firebase/auth'
import {
  DocumentData,
  Firestore,
  QuerySnapshot,
  Unsubscribe,
  collection,
  doc,
  documentId,
  getDoc,
  onSnapshot,
  query,
  setDoc,
  where,
} from 'firebase/firestore'

import * as Errors from '../errors'
import { FirestoreUser } from '../..'

export type FirebaseDate = {
  nanoseconds: number
  seconds: number
}

export const fromFirebaseDate = (date: FirebaseDate) => {
  return dayjs(date.seconds * 1000)
}

export type BrandUserId = string | number

export interface UserInitResult {
  isLoggedIn: boolean
  initPromise: Promise<boolean>
  isInitialized: boolean
}

export class FirebaseUser {
  public brandUserId: BrandUserId = null

  private user: firebaseAuth.User
  private readonly auth: firebaseAuth.Auth
  private initPromise: Promise<boolean> | null = null
  private isInitialized: boolean = false
  private _authStateCallbacks: Array<(isLoggedIn: boolean) => void> = []
  private _initializationPromise: Promise<boolean>

  constructor(private readonly firestore: Firestore, app: firebase.FirebaseApp) {
    this.auth = firebaseAuth.getAuth(app)
    this.auth.setPersistence(firebaseAuth.browserLocalPersistence)

    console.debug('FirebaseUser constructor called at:', new Date().toISOString())

    // Wait for Firebase to determine auth state before making user state available
    this._initializationPromise = this.waitForAuthStateDetermination()
  }

  private async waitForAuthStateDetermination(): Promise<boolean> {
    console.debug('Waiting for Firebase to determine auth state...')

    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        console.debug('Auth state timeout, resolving with false')
        resolve(false)
      }, 5000) // 5 second timeout

      this.auth.onAuthStateChanged((user) => {
        console.debug('Initial onAuthStateChanged fired with user:', user?.uid || 'null')
        clearTimeout(timeoutId)
        this.setUser(user)
        this.setBrandUserId(user?.uid)
        console.debug('Initial auth state determined, user:', user?.uid || 'null')
        resolve(Boolean(user))
      })

      // Also wait for authStateReady to complete
      this.auth.authStateReady().then(() => {
        console.debug('authStateReady completed, current user:', this.auth.currentUser?.uid || 'null')
        if (this.auth.currentUser) {
          clearTimeout(timeoutId)
          console.debug('Setting user from authStateReady')
          this.setUser(this.auth.currentUser)
          this.setBrandUserId(this.auth.currentUser.uid)
          resolve(true)
        }
      }).catch(() => {
        console.debug('authStateReady failed, keeping current state')
      })
    })
  }

  public get id() {
    return this.user?.uid
  }

  /**
   * Enhanced onInit that waits for Firebase to determine auth state before proceeding
   */
  public async onInit(brandId: number): Promise<UserInitResult> {
    console.debug('onInit called at:', new Date().toISOString(), 'brandId:', brandId)

    // Wait for Firebase to determine authentication state first
    console.debug('Waiting for Firebase auth state determination...')
    const isLoggedIn = await this._initializationPromise
    console.debug('Firebase auth state determined:', isLoggedIn)

    // Return the result with correct authentication state
    const result: UserInitResult = {
      isLoggedIn: isLoggedIn,
      initPromise: Promise.resolve(isLoggedIn),
      isInitialized: true
    }

    console.debug('Returning init result - isLoggedIn:', isLoggedIn)
    return result
  }

  /**
   * Get initialization promise for awaiting
   */
  public getInitializationPromise(): Promise<boolean> {
    return this.initPromise || Promise.resolve(Boolean(this.user))
  }

  /**
   * Check if user is ready for operations that require authentication
   */
  public isReady(): boolean {
    return this.isInitialized && Boolean(this.user)
  }

  /**
   * Register a callback to be notified when user state changes
   */
  public onAuthStateChange(callback: (isLoggedIn: boolean) => void): void {
    if (!this._authStateCallbacks) {
      this._authStateCallbacks = []
    }
    this._authStateCallbacks.push(callback)
  }

  public setUser(user: firebaseAuth.User | null): void {
    console.debug('setUser called with user uid:', user?.uid || 'null', 'previous user uid:', this.user?.uid || 'null')
    this.user = user
    console.debug('setUser completed, current user uid:', this.user?.uid || 'null')
  }

  public async logUserLogin(brandId: number, user: firebaseAuth.User): Promise<void> {
    try {
      const userLoggingDoc = doc(this.firestore, 'user_logging', user.uid)
      const savedDoc = await getDoc(userLoggingDoc)
      const lastLogin = new Date()
      const savedData = savedDoc.exists ? savedDoc.data() : null
      const lastBrandLogin = savedData?.brands?.[brandId]?.last_login

      if (lastBrandLogin && dayjs(lastLogin).diff(fromFirebaseDate(lastBrandLogin), 'seconds') <= 10080) return

      const logins = savedData?.brands?.[brandId]?.logins ?? []
      logins.push(lastLogin)

      const userLoggingData = {
        brands: {
          [brandId]: {
            brand_id: brandId,
            last_login: lastLogin,
            logins,
          },
        },
        last_brand_id: brandId,
        created_at: !savedDoc.exists() ? lastLogin : savedDoc.data().created_at,
        updated_at: lastLogin,
      }

      await setDoc(userLoggingDoc, userLoggingData, { merge: true })
    } catch (e) {
      console.error('LOGGING ERROR:', e)
    }
  }

  public setBrandUserId(brandUserId: BrandUserId): void {
    this.brandUserId = brandUserId
  }

  public async getToken(): Promise<string> {
    if (!this.user?.uid) throw new Errors.UserNotLoggedInError()

    const token = await this.user.getIdToken()

    return token
  }

  public get userId(): string {
    if (!this.user?.uid) throw new Errors.UserNotLoggedInError()

    return this.user.uid
  }

  public async getUser(): Promise<DocumentData | undefined> {
    if (!this.user?.uid) throw new Errors.UserNotLoggedInError()

    const user = await getDoc(doc(this.firestore, 'users', this.id))

    return user.data()
  }

  public watchUserProfileForChanges(predicate: (data: QuerySnapshot<DocumentData>) => Promise<boolean>): Promise<DocumentData> {
    let unsub: Unsubscribe

    const docRef = doc(this.firestore, 'users', this.id)

    return new Promise<DocumentData>((resolve, reject) => {
      unsub = onSnapshot(docRef, async (docSnapshot) => {
        console.debug('watchUserProfileForChanges onSnapshot fired at:', new Date().toISOString())
        console.debug('Document exists:', docSnapshot.exists(), 'Document ID:', docSnapshot.id)

        if (!docSnapshot.exists()) {
          console.warn('User document does not exist for ID:', this.id)
          return
        }

        const snapshot = { docs: [docSnapshot] } as QuerySnapshot<DocumentData>

        try {
          const result = await predicate(snapshot)
          console.debug('watchUserProfileForChanges predicate result:', result)

          if (result) {
            console.debug('Predicate matched, unsubscribing and resolving')
            unsub()
            resolve(snapshot.docs[0].data())
          } else {
            console.debug('Predicate did not match, continuing to listen')
          }
        } catch (error) {
          console.error('watchUserProfileForChanges predicate error:', error)
          // Continue listening even if predicate fails, don't reject immediately
        }
      }, (error) => {
        console.error('watchUserProfileForChanges onSnapshot error:', error)
        reject(error)
      })
    })
  }

  /**
   * Continuous listener for user profile changes.
   * Returns unsubscribe function that can be called to stop listening.
   * This is the correct approach for ongoing monitoring of user changes.
   */
  public watchUserProfileForChangesContinuous(
    callback: (userProfile: DocumentData) => void,
    predicate?: (data: QuerySnapshot<DocumentData>) => Promise<boolean>
  ): () => void {
    const docRef = doc(this.firestore, 'users', this.id)

    console.debug('Starting continuous user profile monitoring for user ID:', this.id)

    const unsub = onSnapshot(docRef, async (docSnapshot) => {
      console.debug('Continuous watch: onSnapshot fired at:', new Date().toISOString())

      if (!docSnapshot.exists()) {
        console.warn('Continuous watch: User document does not exist for ID:', this.id)
        return
      }

      const snapshot = { docs: [docSnapshot] } as QuerySnapshot<DocumentData>

      try {
        // If predicate is provided, check it first
        if (predicate) {
          const result = await predicate(snapshot)
          if (!result) {
            console.debug('Continuous watch: Predicate did not match, skipping callback')
            return
          }
        }

        const userProfile = snapshot.docs[0].data()
        console.debug('Continuous watch: Calling callback with user profile, avatar_status:', userProfile.avatar_status)
        callback(userProfile)
      } catch (error) {
        console.error('Continuous watch: Error in callback or predicate:', error)
      }
    }, (error) => {
      console.error('Continuous watch: onSnapshot error:', error)
    })

    // Return unsubscribe function
    return () => {
      console.debug('Unsubscribing from continuous user profile monitoring')
      unsub()
    }
  }

  public async login(username: string, password: string): Promise<void> {
    if (this.auth.currentUser) await this.auth.signOut()

    const user = await firebaseAuth.signInWithEmailAndPassword(this.auth, username, password)
    this.setUser(user.user)
  }

  public async logout(): Promise<void> {
    await this.auth.signOut()
    this.setUser(null)
  }

  public async sendPasswordResetEmail(email: string): Promise<void> {
    await firebaseAuth.sendPasswordResetEmail(this.auth, email)
  }

  public async confirmPasswordReset(code: string, newPassword: string): Promise<void> {
    await firebaseAuth.confirmPasswordReset(this.auth, code, newPassword)
  }
}
