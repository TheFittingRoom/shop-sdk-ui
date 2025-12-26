import dayjs from 'dayjs'
import { initializeApp, FirebaseApp, FirebaseOptions } from 'firebase/app'
import {
  DocumentData,
  Firestore,
  QueryFieldFilterConstraint,
  QuerySnapshot,
  Unsubscribe,
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  onSnapshot,
  query,
  setDoc,
  where,
} from 'firebase/firestore'
import {
  Auth,
  User,
  browserLocalPersistence,
  confirmPasswordReset,
  getAuth,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
} from 'firebase/auth'
import { FirestoreUser } from '@/api/gen/responses'
import { getConfig, EnvName } from '@/lib/config'

export type AuthUser = User
export type UserProfile = FirestoreUser

export { where }

export type FirebaseDate = {
  nanoseconds: number
  seconds: number
}

export const firebaseDateToDayjs = (date: FirebaseDate) => {
  return dayjs(date.seconds * 1000)
}

const LOGIN_TRACKING_PERIOD_SECONDS = 1800 // 30 minutes

let firebaseApp: FirebaseApp | null = null

export function getFirebaseApp(): FirebaseApp {
  if (!firebaseApp) {
    throw new Error('Firebase not initialized. Call _init first.')
  }
  return firebaseApp
}

export class FirestoreManager {
  private readonly firestore: Firestore

  constructor(firestore: Firestore) {
    this.firestore = firestore
  }

  public async getDocData<T extends DocumentData = DocumentData>(collectionName: string, docId: string): Promise<T | null> {
    const docRef = this.doc(collectionName, docId)
    const docSnap = await getDoc(docRef)
    if (docSnap.exists()) {
      return docSnap.data() as T
    } else {
      return null
    }
  }

  public async setDocData<T extends DocumentData = DocumentData>(collectionName: string, docId: string, data: T): Promise<void> {
    const docRef = this.doc(collectionName, docId)
    await setDoc(docRef, data)
  }

  public async mergeDocData<T extends DocumentData = DocumentData>(collectionName: string, docId: string, data: Partial<T>): Promise<void> {
    const docRef = this.doc(collectionName, docId)
    await setDoc(docRef, data, { merge: true })
  }

  public listenToDoc<T extends DocumentData = DocumentData>(
    collectionName: string,
    docId: string,
    callback: (data: T | null) => void,
  ): Unsubscribe {
    const docRef = this.doc(collectionName, docId)
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        callback(docSnap.data() as T)
      } else {
        callback(null)
      }
    })
    return unsubscribe
  }

  public async queryDocs<T extends DocumentData = DocumentData>(
    collectionName: string,
    constraints: QueryFieldFilterConstraint[],
  ): Promise<QuerySnapshot<T>> {
    const q = query(this.collection(collectionName), ...constraints)
    return getDocs(q) as Promise<QuerySnapshot<T>>
  }

  private collection(collectionName: string) {
    return collection(this.firestore, collectionName)
  }

  private doc(collectionName: string, docId: string) {
    return doc(this.firestore, collectionName, docId)
  }
}

let firestoreManager: FirestoreManager | null = null

export function getFirestoreManager(): FirestoreManager {
  if (!firestoreManager) {
    throw new Error('Firebase not initialized. Call _init first.')
  }
  return firestoreManager
}

export class AuthManager {
  private readonly auth: Auth
  private readonly brandId: number
  private userProfile: UserProfile | null = null
  private readonly authStateChangeListeners: Set<(authUser: AuthUser | null) => void> = new Set()
  private readonly userProfileChangeListeners: Set<(userProfile: UserProfile | null) => void> = new Set()
  private listenToUserProfileUnsub: Unsubscribe | null = null

  constructor(auth: Auth, brandId: number) {
    this.auth = auth
    this.brandId = brandId
    this.addAuthStateChangeListener((authUser) => this.handleAuthStateChanged(authUser))
    onAuthStateChanged(this.auth, (authUser) => {
      this.authStateChangeListeners.forEach((callback) => callback(authUser))
    })
  }

  addAuthStateChangeListener(callback: (authUser: AuthUser | null) => void): () => void {
    this.authStateChangeListeners.add(callback)
    callback(this.auth.currentUser)
    return () => {
      this.authStateChangeListeners.delete(callback)
    }
  }

  removeAuthStateChangeListener(callback: (authUser: AuthUser | null) => void): void {
    this.authStateChangeListeners.delete(callback)
  }

  addUserProfileChangeListener(callback: (userProfile: UserProfile | null) => void): () => void {
    this.userProfileChangeListeners.add(callback)
    callback(this.userProfile)
    return () => {
      this.userProfileChangeListeners.delete(callback)
    }
  }

  removeUserProfileChangeListener(callback: (userProfile: UserProfile | null) => void): void {
    this.userProfileChangeListeners.delete(callback)
  }

  getAuthUser(): AuthUser | null {
    return this.auth.currentUser
  }

  async getAuthToken(forceRefresh: boolean = false): Promise<string> {
    const user = this.auth.currentUser
    if (!user) {
      throw new Error('No authenticated user')
    }
    return user.getIdToken(forceRefresh)
  }

  async getUserProfile(forceRefresh: boolean = false): Promise<UserProfile | null> {
    if (!this.auth.currentUser) {
      return null
    }
    if (this.userProfile && !forceRefresh) {
      return this.userProfile
    }
    const firestore = getFirestoreManager()
    const profile = await firestore.getDocData<UserProfile>(
      'users',
      this.auth.currentUser.uid,
    )
    this.userProfile = profile
    return this.userProfile
  }

  async login(email: string, password: string): Promise<AuthUser> {
    const userCredential = await signInWithEmailAndPassword(this.auth, email, password)
    return userCredential.user
  }

  async logout(): Promise<void> {
    await this.auth.signOut()
  }

  async sendPasswordResetEmail(email: string): Promise<void> {
    await sendPasswordResetEmail(this.auth, email)
  }

  async confirmPasswordReset(code: string, newPassword: string): Promise<void> {
    await confirmPasswordReset(this.auth, code, newPassword)
  }

  private handleAuthStateChanged(authUser: AuthUser | null) {
    // Clean up previous listener
    if (this.listenToUserProfileUnsub) {
      this.listenToUserProfileUnsub()
      this.listenToUserProfileUnsub = null
    }

    if (authUser) {
      // Listen to and publish user profile changes
      this.listenToUserProfileUnsub = getFirestoreManager().listenToDoc<UserProfile>('users', authUser.uid, (doc) => {
        this.userProfile = doc
        this.userProfileChangeListeners.forEach((callback) => callback(this.userProfile))
      })

      // Track user login activity
      ;(async () => {
        try {
          const firestore = getFirestoreManager()
          const userLoggingDocId = authUser.uid
          const userLoggingDoc = await firestore.getDocData('user_logging', userLoggingDocId)
          const lastLogin = new Date()
          const savedData = userLoggingDoc ?? {}
          const lastBrandLogin = savedData?.brands?.[this.brandId]?.last_login

          if (
            !lastBrandLogin ||
            dayjs(lastLogin).diff(firebaseDateToDayjs(lastBrandLogin), 'seconds') > LOGIN_TRACKING_PERIOD_SECONDS
          ) {
            const logins = savedData?.brands?.[this.brandId]?.logins ?? []
            logins.push(lastLogin)

            const userLoggingData = {
              brands: {
                ...(savedData.brands ?? {}),
                [this.brandId]: {
                  brand_id: this.brandId,
                  last_login: lastLogin,
                  logins,
                },
              },
              last_brand_id: this.brandId,
              created_at: savedData.created_at ?? lastLogin,
              updated_at: lastLogin,
            }

            await firestore.mergeDocData('user_logging', userLoggingDocId, userLoggingData)
          }
        } catch (error) {
          console.error('[TFR] Error logging user login activity:', error)
        }
      })()
    } else {
      // Clear user profile and publish null profile
      this.userProfile = null
      this.userProfileChangeListeners.forEach((callback) => callback(this.userProfile))
    }
  }
}

let authManager: AuthManager | null = null

export function getAuthManager(): AuthManager {
  if (!authManager) {
    throw new Error('Firebase not initialized. Call _init first.')
  }
  return authManager
}

export async function _init(envName: EnvName, brandId: number) {
  // Initialize Firebase App
  {
    const { firebase: sdkFirebaseConfig } = getConfig(envName)
    const firebaseConfig: FirebaseOptions = {
      apiKey: sdkFirebaseConfig.apiKey,
      authDomain: sdkFirebaseConfig.authDomain,
      projectId: sdkFirebaseConfig.projectId,
      storageBucket: sdkFirebaseConfig.storageBucket,
      messagingSenderId: sdkFirebaseConfig.messagingSenderId,
      appId: sdkFirebaseConfig.appId,
      measurementId: sdkFirebaseConfig.measurementId,
    }
    firebaseApp = initializeApp(firebaseConfig)
  }

  // Initialize Firestore
  {
    const firestore = getFirestore(firebaseApp)
    firestoreManager = new FirestoreManager(firestore)
  }

  // Initialize Auth manager
  {
    const auth = getAuth(firebaseApp)
    auth.setPersistence(browserLocalPersistence)
    authManager = new AuthManager(auth, brandId)
  }
}
