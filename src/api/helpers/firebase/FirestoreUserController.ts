import {
  DocumentData,
  Firestore,
  Unsubscribe,
  doc,
  getDoc,
  onSnapshot,
} from 'firebase/firestore'

import * as Errors from '../errors'
import { FirestoreUser } from '../../gen/responses'
import { FirebaseAuthUserController } from './FirebaseAuthUserController'

export class FirestoreUserController {
  private userProfile: FirestoreUser
  private getUserPromise: Promise<FirestoreUser>
  constructor(
    private readonly firestore: Firestore,
    private firebaseAuthUserController: FirebaseAuthUserController) {
    this.getUserPromise = this.FetchUser(true)
  }

  public async FetchUser(skipCache: boolean): Promise<FirestoreUser> {
    if (!skipCache) {
      if (this.userProfile) {
        console.debug("returning user from cache")
        return this.userProfile
      }
      if (this.getUserPromise) {
        console.debug("returning user from promise")
        this.userProfile = await this.getUserPromise
        return this.userProfile
      }
    } else {
      this.getUserPromise = null
    }
    console.debug("returning user from firestore")
    const user = await this.firebaseAuthUserController.GetUserOrNotLoggedIn()
    const snapshot = await getDoc(doc(this.firestore, 'users', user.uid))
    if (!snapshot.exists()) {
      console.error("user not found")
      throw new Errors.UserNotFoundError(user.uid)
    }
    this.userProfile = snapshot.data() as FirestoreUser
    return this.userProfile
  }

  /**
   * Watches a user's profile until a predicate returns true.
   * Resolves with the document data when the predicate is met.
   */
  public async WatchUserProfileForChanges(
    dataCallbackAndUnsub: (data: DocumentData) => Promise<boolean>,
  ): Promise<DocumentData> {
    const user = await this.firebaseAuthUserController.GetUserOrNotLoggedIn()
    let unsub: Unsubscribe | undefined

    return new Promise<DocumentData>((resolve, reject) => {
      const docRef = doc(this.firestore, 'users', user.uid)

      unsub = onSnapshot(
        docRef,
        async (docSnapshot) => {
          if (!docSnapshot.exists()) {
            unsub()
            throw new Errors.UserNotFoundError(user.uid)
          }

          const data = docSnapshot.data()
          const result = await dataCallbackAndUnsub(data)
          if (result) {
            unsub?.()
            resolve(data)
          }
          // wait for next event dont exit
        },
        (error) => {
          console.error('watchUserProfileForChanges onSnapshot error:', error)
          unsub?.()
          reject(error)
        },
      )
    })
  }
}

