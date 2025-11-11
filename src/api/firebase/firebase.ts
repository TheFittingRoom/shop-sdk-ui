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
} from 'firebase/firestore'

import { Config } from '../helpers/config'
import { FirebaseUser } from './firebase-user'

export class Firebase {
  public user: FirebaseUser

  public readonly firestore: Firestore

  constructor() {
    const firebaseKeys = Config.getInstance().firebase
    const firebaseApp = firebase.initializeApp(firebaseKeys)

    this.firestore = getFirestore(firebaseApp)
    this.user = new FirebaseUser(this.firestore, firebaseApp)
  }

  public onInit(brandId: number) {
    return this.user.onInit(brandId)
  }

  public query(collectionName: string, constraint: QueryFieldFilterConstraint, unsubscribeWhenData: boolean = true) {
    const q = query(collection(this.firestore, collectionName), constraint)

    return this.promisefyOnSnapshot(q, unsubscribeWhenData)
  }

  public getDocs(collectionName: string, constraints: QueryFieldFilterConstraint[]) {
    const q = query(collection(this.firestore, collectionName), ...constraints)

    return getDocs(q)
  }

  public async getDoc(collectionName: string, id: string) {
    const docRef = doc(this.firestore, collectionName, id)
    const docSnap = await getDoc(docRef)

    return docSnap.exists() ? docSnap.data() : null
  }

  private promisefyOnSnapshot = (q: Query<DocumentData>, unsubscribeWhenData: boolean) => {
    let unsub: Unsubscribe

    const promise = new Promise<QuerySnapshot<DocumentData>>((resolve) => {
      unsub = onSnapshot(q, (snapshot) => {
        resolve(snapshot)
        if (unsubscribeWhenData) unsub()
      })
    })

    return { promise, unsubscribe: () => unsub() }
  }
}
