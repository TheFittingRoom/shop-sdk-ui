import dayjs from 'dayjs/esm'
import * as firebase from 'firebase/app'
import * as firebaseAuth from 'firebase/auth'
import {
  DocumentData,
  Firestore,
  QueryFieldFilterConstraint,
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
  private initResolve: ((value: boolean) => void) | null = null
  private pendingAuthStateChanges: firebaseAuth.User[] = []

  constructor(private readonly firestore: Firestore, app: firebase.FirebaseApp) {
    this.auth = firebaseAuth.getAuth(app)
    this.auth.setPersistence(firebaseAuth.browserLocalPersistence)
  }

  public get id() {
    return this.user?.uid
  }

  /**
   * Enhanced onInit that enables parallel initialization
   * Returns immediately with initialization status and promise
   */
  public onInit(brandId: number): UserInitResult {
    // If already initialized, return cached result
    if (this.isInitialized && this.initPromise) {
      return {
        isLoggedIn: Boolean(this.user),
        initPromise: this.initPromise,
        isInitialized: this.isInitialized
      }
    }

    // Create new init promise if not already in progress
    if (!this.initPromise) {
      this.initPromise = new Promise<boolean>((resolve) => {
        this.initResolve = resolve
      })

      // Set up auth state listener
      this.auth.onAuthStateChanged((user) => {
        this.handleAuthStateChange(user, brandId)
      })

      // Start auth state readiness (non-blocking)
      this.auth.authStateReady().then(() => {
        // If we have a current user and no pending changes, resolve
        const currentUser = this.auth.currentUser
        if (currentUser) {
          this.handleAuthStateChange(currentUser, brandId)
        } else if (!this.pendingAuthStateChanges.length) {
          // No user and no pending changes, resolve with false
          this.resolveInitialization(false)
        }
      }).catch(() => {
        // Auth state ready failed, resolve with current state
        this.resolveInitialization(Boolean(this.user))
      })
    }

    return {
      isLoggedIn: Boolean(this.user),
      initPromise: this.initPromise,
      isInitialized: this.isInitialized
    }
  }

  /**
   * Handle authentication state changes
   */
  private handleAuthStateChange(user: firebaseAuth.User, brandId: number) {
    this.pendingAuthStateChanges.push(user)

    // Process pending changes
    const latestUser = this.pendingAuthStateChanges[this.pendingAuthStateChanges.length - 1]
    this.pendingAuthStateChanges = []

    this.setUser(latestUser)
    this.setBrandUserId(latestUser?.uid)

    // If this completes our initialization, resolve
    if (!this.isInitialized) {
      this.resolveInitialization(Boolean(latestUser))
    }
  }

  /**
   * Resolve the initialization promise
   */
  private resolveInitialization(isLoggedIn: boolean) {
    if (this.initResolve) {
      this.initResolve(isLoggedIn)
      this.initResolve = null
    }
    this.isInitialized = true
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

  public setUser(user: firebaseAuth.User | null): void {
    this.user = user
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

  public watchUserProfileForChanges(callback: (data: FirestoreUser) => void): () => void {
    let unsub: Unsubscribe

    const q = query(collection(this.firestore, 'users'), where(documentId(), '==', this.id))

    unsub = onSnapshot(q, (snapshot) => callback(snapshot.docs[0].data() as FirestoreUser))

    return () => unsub()
  }

  public watchUserProfileForFrames(predicate: (data: QuerySnapshot<DocumentData>) => Promise<boolean>): Promise<DocumentData> {
    let unsub: Unsubscribe

    const q = query(collection(this.firestore, 'users'), where(documentId(), '==', this.id))

    return new Promise<DocumentData>((resolve) => {
      unsub = onSnapshot(q, async (snapshot) => {
        if (!(await predicate(snapshot))) return
        unsub()
        resolve(snapshot.docs[0].data())
      })
    })
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
