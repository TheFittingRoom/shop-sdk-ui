import dayjs from 'dayjs/esm'
import * as firebase from 'firebase/app'
import { User, Auth, getAuth, browserLocalPersistence, signInWithEmailAndPassword, sendPasswordResetEmail, confirmPasswordReset } from 'firebase/auth'
import {
  DocumentData,
  Firestore,
  QuerySnapshot,
  Unsubscribe,
  doc,
  getDoc,
  onSnapshot,
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
  private user: User
  private intializationUserPromise: Promise<User>
  private readonly auth: Auth
  private _authStateCallbacks: Array<(isLoggedIn: boolean) => void> = []

  constructor(private readonly firestore: Firestore, app: firebase.FirebaseApp) {
    this.auth = getAuth(app)
    this.auth.setPersistence(browserLocalPersistence)
    // prefetch firestore user instantly. Result is stored internally.
    this.intializationUserPromise = this.fetchCachedFirestoreUser()
  }

  private async fetchCachedFirestoreUser(): Promise<User> {
    if (this.user) {
      Promise.resolve(this.user)
    }
    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        resolve(null)
        // todo test shorter timeout
      }, 5000) // 5 second timeout

      this.auth.onAuthStateChanged((user) => {
        clearTimeout(timeoutId)
        this.setUser(user)
        resolve(this.user)
      })

      this.auth.authStateReady().then(() => {
        if (this.auth.currentUser) {
          clearTimeout(timeoutId)
          this.setUser(this.auth.currentUser)
          resolve(this.auth.currentUser)
        } else {
          resolve(null)
        }
      }).catch(() => {
        console.debug('authStateReady failed, keeping current state')
      })
    })
  }


  public async User(): Promise<User | boolean> {
    const user = await this.intializationUserPromise
    if (!this.user) {
      return Promise.resolve(false)
    }
    return Promise.resolve(user)
  }

  public onAuthStateChange(callback: (isLoggedIn: boolean) => void): void {
    if (!this._authStateCallbacks) {
      this._authStateCallbacks = []
    }
    this._authStateCallbacks.push(callback)
  }

  public setUser(user: User | null): void {
    console.debug('setUser called with user uid:', user?.uid || 'null', 'previous user uid:', this.user?.uid || 'null')
    this.user = user
    console.debug('setUser completed, current user uid:', this.user?.uid || 'null')
  }

  public async getToken(): Promise<string> {
    if (!this.user?.uid) throw new Errors.UserNotLoggedInError()

    const token = await this.user.getIdToken()

    return token
  }

  public async getUser(): Promise<DocumentData | undefined> {
    if (!this.user?.uid) throw new Errors.UserNotLoggedInError()

    const user = await getDoc(doc(this.firestore, 'users', this.user.uid))

    return user.data()
  }

  public async watchUserProfileForChanges(predicate: (data: QuerySnapshot<DocumentData>) => Promise<boolean>): Promise<DocumentData> {
    let unsub: Unsubscribe
    const user = await this.User() as User
    if (!user) {
      throw new Error("watchUserProfileForChanges called without user init")
    }

    const docRef = doc(this.firestore, 'users', user.uid)

    return new Promise<DocumentData>((resolve, reject) => {
      unsub = onSnapshot(docRef, async (docSnapshot) => {
        if (!docSnapshot.exists()) {
          console.warn('User document does not exist for ID:', user.uid)
          return
        }
        const snapshot = { docs: [docSnapshot] } as QuerySnapshot<DocumentData>
        try {
          const result = await predicate(snapshot)
          if (result) {
            unsub()
            resolve(snapshot.docs[0].data())
          } else {
          }
        } catch (error) {
          console.error('watchUserProfileForChanges predicate error:', error)
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
    userID: string,
    callback: (userProfile: DocumentData) => void,
    predicate?: (data: QuerySnapshot<DocumentData>) => Promise<boolean>
  ): () => void {

    const docRef = doc(this.firestore, 'users', userID)

    console.debug('Starting continuous user profile monitoring for user ID:', userID)

    const unsub = onSnapshot(docRef, async (docSnapshot) => {
      console.debug('Continuous watch: onSnapshot fired at:', new Date().toISOString())

      if (!docSnapshot.exists()) {
        console.warn('Continuous watch: User document does not exist for ID:', userID)
        return
      }

      const snapshot = { docs: [docSnapshot] } as QuerySnapshot<DocumentData>

      try {
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

    return () => {
      console.debug('Unsubscribing from continuous user profile monitoring')
      unsub()
    }
  }

  public async login(username: string, password: string): Promise<void> {
    if (this.auth.currentUser) await this.auth.signOut()

    const user = await signInWithEmailAndPassword(this.auth, username, password)
    this.setUser(user.user)
  }

  public async logout(): Promise<void> {
    await this.auth.signOut()
    this.setUser(null)
  }

  public async sendPasswordResetEmail(email: string): Promise<void> {
    await sendPasswordResetEmail(this.auth, email)
  }

  public async confirmPasswordReset(code: string, newPassword: string): Promise<void> {
    await confirmPasswordReset(this.auth, code, newPassword)
  }
}
