import dayjs from 'dayjs/esm'
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
import {
  DocumentData,
  Firestore,
  QuerySnapshot, // This is no longer used in the watchers, but might be needed elsewhere
  DocumentSnapshot, // Used for correct typing
  Unsubscribe,
  doc,
  getDoc,
  onSnapshot,
  setDoc,
} from 'firebase/firestore'

import * as Errors from '../errors'

export type FirebaseDate = {
  nanoseconds: number
  seconds: number
}

export const fromFirebaseDate = (date: FirebaseDate) => {
  return dayjs(date.seconds * 1000)
}

export class FirebaseUser {
  private user: User | null = null // Initialize as null
  private initializationUserPromise: Promise<User | null>
  private readonly auth: Auth

  constructor(
    private readonly firestore: Firestore,
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
      return null
    }
  }

  /**
   * Centralized helper to get the authenticated user.
   * Awaits initialization and throws if no user is found.
   */
  private async getAuthUser(): Promise<User> {
    if (this.user) {
      return Promise.resolve(this.user)
    }
    // Await the init promise. This runs only once on startup.
    const user = await this.initializationUserPromise

    // If init is done and user is null (or this.user is null), throw.
    if (!user || !this.user) {
      throw new Errors.UserNotLoggedInError()
    }

    return this.user
  }

  public async GetToken(): Promise<string> {
    // The helper handles all auth checks and errors
    const user = await this.getAuthUser()
    return user.getIdToken()
  }

  public async GetUser(): Promise<DocumentData | undefined> {
    // The helper handles all auth checks and errors
    const user = await this.getAuthUser()
    const userDoc = await getDoc(doc(this.firestore, 'users', user.uid))
    return userDoc.data()
  }

  /**
   * Watches a user's profile until a predicate returns true.
   * Resolves with the document data when the predicate is met.
   */
  public async WatchUserProfileForChanges(
    predicate: (data: DocumentData) => Promise<boolean>,
  ): Promise<DocumentData> {
    const user = await this.getAuthUser()
    let unsub: Unsubscribe | undefined

    return new Promise<DocumentData>((resolve, reject) => {
      const docRef = doc(this.firestore, 'users', user.uid)

      unsub = onSnapshot(
        docRef,
        async (docSnapshot) => {
          if (!docSnapshot.exists()) {
            console.warn('User document does not exist for ID:', user.uid)
            return
          }

          const data = docSnapshot.data()
          try {
            const result = await predicate(data)
            if (result) {
              unsub?.() // Unsubscribe when predicate is met
              resolve(data)
            }
          } catch (error) {
            console.error('watchUserProfileForChanges predicate error:', error)
          }
        },
        (error) => {
          console.error('watchUserProfileForChanges onSnapshot error:', error)
          unsub?.()
          reject(error)
        },
      )
    })
  }

  /**
   * Continuously watches a user profile and fires a callback on changes.
   * An optional predicate can filter updates.
   */
  public WatchUserProfileForChangesContinuous(
    userID: string,
    callback: (userProfile: DocumentData) => void,
    predicate?: (data: DocumentData) => Promise<boolean>,
  ): () => void {
    const docRef = doc(this.firestore, 'users', userID)
    console.debug('Starting continuous user profile monitoring for user ID:', userID)

    const unsub = onSnapshot(
      docRef,
      async (docSnapshot) => {
        console.debug('Continuous watch: onSnapshot fired at:', new Date().toISOString())

        if (!docSnapshot.exists()) {
          console.warn('Continuous watch: User document does not exist for ID:', userID)
          return
        }

        const userProfile = docSnapshot.data()

        try {
          if (predicate) {
            const result = await predicate(userProfile)
            if (!result) {
              console.debug('Continuous watch: Predicate did not match, skipping callback')
              return
            }
          }

          console.debug('Continuous watch: Calling callback with user profile, avatar_status:', userProfile.avatar_status)
          callback(userProfile)
        } catch (error) {
          console.error('Continuous watch: Error in callback or predicate:', error)
        }
      },
      (error) => {
        console.error('Continuous watch: onSnapshot error:', error)
      },
    )

    return () => {
      console.debug('Unsubscribing from continuous user profile monitoring')
      unsub()
    }
  }

  public async Login(username: string, password: string): Promise<void> {
    if (this.auth.currentUser) {
      await this.auth.signOut()
    }

    const userCred = await signInWithEmailAndPassword(this.auth, username, password)
    this.user = userCred.user

    this.initializationUserPromise = Promise.resolve(this.user)
  }

  public async Logout(): Promise<void> {
    await this.auth.signOut()
    this.user = null

    // **IMPROVEMENT**: Reset the init promise to re-run on next check
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

  public async LogUserLogin(brandId: number, user: User) {
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
}

