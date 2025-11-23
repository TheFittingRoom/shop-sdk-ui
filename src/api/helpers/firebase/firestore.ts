import * as firebase from 'firebase/app'
import {
  DocumentData,
  Firestore,
  Query,
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
} from 'firebase/firestore'
import { Config } from '../config'
import dayjs from 'dayjs'
import { User } from 'firebase/auth'

export type FirebaseDate = {
  nanoseconds: number
  seconds: number
}

export const fromFirebaseDate = (date: FirebaseDate) => {
  return dayjs(date.seconds * 1000)
}

export class FirestoreController {
  public readonly firestore: Firestore

  constructor(private config: Config) {
    const firebaseKeys = this.config.ENV.FIREBASE;

    const firebaseConfig = {
      apiKey: firebaseKeys.FIREBASE_API_KEY,
      authDomain: firebaseKeys.FIREBASE_AUTH_DOMAIN,
      projectId: firebaseKeys.FIREBASE_PROJECT_ID,
      storageBucket: firebaseKeys.FIREBASE_STORAGE_BUCKET,
      messagingSenderId: firebaseKeys.FIREBASE_MESSAGING_SENDER_ID,
      appId: firebaseKeys.FIREBASE_APP_ID,
      measurementId: firebaseKeys.FIREBASE_MEASUREMENT_ID,
    };

    this.firestore = getFirestore(firebase.initializeApp(firebaseConfig))
  }

  public query(collectionName: string, constraint: QueryFieldFilterConstraint, unsubscribeWhenData: boolean = true) {
    const q = query(collection(this.firestore, collectionName), constraint)

    return this.promisifyOnSnapshot(q, unsubscribeWhenData)
  }

  public getDocs(collectionName: string, constraints: QueryFieldFilterConstraint[]): Promise<QuerySnapshot<DocumentData>> {
    console.debug('getDocs:', collectionName, 'constraints:', constraints)
    const q = query(collection(this.firestore, collectionName), ...constraints)

    return getDocs(q)
  }

  public async getDoc(collectionName: string, id: string): Promise<DocumentData | null> {
    const docRef = doc(this.firestore, collectionName, id)
    const docSnap = await getDoc(docRef)

    return docSnap.exists() ? docSnap.data() : null
  }

  private promisifyOnSnapshot = (q: Query<DocumentData>, unsubscribeWhenData: boolean) => {
    let unsub: Unsubscribe

    const promise = new Promise<QuerySnapshot<DocumentData>>((resolve) => {
      unsub = onSnapshot(q, (snapshot) => {
        resolve(snapshot)
        if (unsubscribeWhenData) unsub()
      })
    })

    return { promise, unsubscribe: () => unsub() }
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
