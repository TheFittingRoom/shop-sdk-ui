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
import { Config } from '../config'
import { FirebaseUser } from './user'
import { User } from 'firebase/auth'

export class FirebaseController {
  public userController: FirebaseUser

  public readonly firestore: Firestore

  constructor() {
    const firebaseKeys = Config.getInstance().firebase
    const firebaseApp = firebase.initializeApp(firebaseKeys)

    this.firestore = getFirestore(firebaseApp)
    // auto login user in constructor
    this.userController = new FirebaseUser(this.firestore, firebaseApp)
  }

  public async getUser(): Promise<User | boolean> {
    return await this.userController.User()
  }

  public query(collectionName: string, constraint: QueryFieldFilterConstraint, unsubscribeWhenData: boolean = true) {
    const q = query(collection(this.firestore, collectionName), constraint)

    return this.promisefyOnSnapshot(q, unsubscribeWhenData)
  }

  public getDocs(collectionName: string, constraints: QueryFieldFilterConstraint[]): Promise<QuerySnapshot<DocumentData>> {
    const q = query(collection(this.firestore, collectionName), ...constraints)

    return getDocs(q)
  }

  public async getDoc(collectionName: string, id: string): Promise<DocumentData | null> {
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
