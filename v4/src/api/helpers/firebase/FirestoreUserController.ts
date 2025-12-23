import {
  DocumentData,
  DocumentSnapshot,
  Unsubscribe,
  doc,
  getDoc,
  onSnapshot,
} from 'firebase/firestore'

import { FirestoreUser } from '../../gen/responses'
import { FirebaseAuthUserController } from './FirebaseAuthUserController'
import { FirestoreController } from './firestore'
import { User } from 'firebase/auth'
import { UserNotFoundError, UserNotLoggedInError } from '../errors'

export class FirestoreUserController {
  private userProfile: FirestoreUser
  private getUserPromise: Promise<FirestoreUser>
  constructor(
    private readonly firestoreController: FirestoreController,
    private firebaseAuthUserController: FirebaseAuthUserController) {
    this.getUserPromise = this.GetUser(true)
  }

  // we must throw an error since its called in constructor
  public async GetUser(skipCache: boolean): Promise<FirestoreUser> {
    console.debug("GetUser", skipCache)
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
    this.getUserPromise = this.firebaseAuthUserController.GetUserOrNotLoggedIn().then((authUser: User) => {
      return getDoc(doc(this.firestoreController.firestore, 'users', authUser.uid))
    }).then((snapshot: DocumentSnapshot<DocumentData>) => {
      if (!snapshot.exists()) {
        console.error("user not found")
        return Promise.reject(UserNotFoundError)
      }
      this.userProfile = snapshot.data() as FirestoreUser
      return this.userProfile
    }).catch((error: Error) => {
      throw error
    })

    this.userProfile = await this.getUserPromise
    return this.userProfile
  }

  /**
   * Watches a user's profile until a predicate returns true.
   * Resolves with the document data when the predicate is met.
   */
  public async WatchFirestoreUserChange(
    dataCallbackAndUnsub: (data: DocumentData) => Promise<boolean>,
  ): Promise<FirestoreUser> {
    const user = await this.firebaseAuthUserController.GetUserOrNotLoggedIn()
    if (!user) {
      throw UserNotLoggedInError
    }
    let unsub: Unsubscribe | undefined

    return new Promise<FirestoreUser>((resolve, reject) => {
      const docRef = doc(this.firestoreController.firestore, 'users', (user as User).uid)

      unsub = onSnapshot(
        docRef,
        async (docSnapshot) => {
          if (!docSnapshot.exists()) {
            unsub()
            reject(UserNotFoundError)
            return
          }

          const data = docSnapshot.data()
          try {
            const unsubscribe = await dataCallbackAndUnsub(data)
            if (unsubscribe) {
              unsub?.()
              resolve(data as FirestoreUser)
            }
          } catch (error) {
            unsub?.()
            reject(error)
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

  public async WriteUserLogging(brandId: number) {
    this.firebaseAuthUserController.GetUserOrNotLoggedIn().then((user: User) => {
      return this.firestoreController.LogUserLogin(brandId, user)
    }).catch((error: Error) => {
      console.error(error)
      throw error
    })
  }
}

