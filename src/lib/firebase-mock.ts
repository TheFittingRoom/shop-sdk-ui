// In-memory Firebase Auth + Firestore replacements driven by InitParams.testHooks.
//
// Activated only when the SDK is initialized with `testHooks` set. Production
// callers MUST NOT set that field; it exists as a data hatch for the Playwright
// e2e suite so tests can run without real Firebase credentials or emulators.
//
// The branch that swaps real → mock lives in exactly one place: the top of
// `_init` in `src/lib/firebase.ts`. Nothing else in `src/` knows about test
// mode.

import type { DocumentData, QuerySnapshot, Unsubscribe } from 'firebase/firestore'
import type { AuthUser, UserProfile } from '@/lib/firebase'
import { getLogger } from '@/lib/logger'

const logger = getLogger('firebase-mock')

/**
 * Test-only data hatch. Production callers MUST NOT set `InitParams.testHooks`.
 *
 * `auth` omitted → simulates a logged-out shopper.
 * `auth.profile` provided → auto-seeds `firestore.docs.users[uid]` so callers
 * only need to specify the profile once.
 * `device` provided → overrides view.ts's Bowser/touch-based DeviceLayout
 * detection. Lets tests (or `?tfr-test-device=…` on the theme URL) force a
 * specific layout without spoofing user-agent + touch capability.
 */
export interface TestHooks {
  auth?: {
    uid: string
    email: string
    idToken: string
    profile?: UserProfile
  }
  // Accounts the sign-in form can switch to: MockAuthManager.login matches on
  // email. Profiles are seeded into the `users` collection like auth.profile.
  accounts?: NonNullable<TestHooks['auth']>[]
  // Handed the installed mocks, so the host page can change the signed-in
  // user or a Firestore doc while widgets stay mounted.
  onMocks?: (mocks: { auth: MockAuthManager; firestore: MockFirestoreManager }) => void
  firestore?: {
    docs?: Record<string, Record<string, Record<string, unknown>>>
  }
  // `layout` is a string union of the DeviceLayout enum values; using a string
  // type here avoids a cycle (TestHooks → DeviceLayout → ... → TestHooks via
  // store.ts). view.ts casts to DeviceLayout at the use site.
  device?: {
    layout: 'mobile-portrait' | 'mobile-landscape' | 'tablet-portrait' | 'tablet-landscape' | 'desktop'
    // Defaults to `layout.startsWith('mobile')` when omitted.
    isMobileDevice?: boolean
  }
}

// ---------------------------------------------------------------------------
// Interfaces — the public surface of the real managers. Both the real and the
// mock classes implement these; firebase.ts's module variables type against
// them so call sites stay unchanged regardless of which implementation is
// installed.
// ---------------------------------------------------------------------------

// A query filter as plain data, rather than Firebase's QueryFieldFilterConstraint.
//
// Two reasons. The constraint objects Firebase's `where()` returns are opaque —
// field, operator and value live on private members — so an implementation that
// isn't Firebase (i.e. the test mock) cannot honour them and has to return
// everything. And it kept a Firebase type in the interface every caller sees,
// for no benefit to those callers.
//
// Only equality is modelled, because only equality is used. Widening this to
// Firebase's full WhereFilterOp union would let callers write comparisons the
// mock silently does not apply — a test would pass while filtering nothing.
// Add operators here, and to both implementations, when something needs them.
export interface QueryFilter {
  field: string
  op: '=='
  value: unknown
}

export interface IFirestoreManager {
  getDocData<T extends DocumentData = DocumentData>(collectionName: string, docId: string): Promise<T | null>
  setDocData<T extends DocumentData = DocumentData>(collectionName: string, docId: string, data: T): Promise<void>
  mergeDocData<T extends DocumentData = DocumentData>(
    collectionName: string,
    docId: string,
    data: Partial<T>,
  ): Promise<void>
  listenToDoc<T extends DocumentData = DocumentData>(
    collectionName: string,
    docId: string,
    callback: (data: T | null) => void,
  ): Unsubscribe
  queryDocs<T extends DocumentData = DocumentData>(
    collectionName: string,
    filters: QueryFilter[],
  ): Promise<QuerySnapshot<T>>
}

export interface IAuthManager {
  addAuthStateChangeListener(callback: (authUser: AuthUser | null) => void): () => void
  removeAuthStateChangeListener(callback: (authUser: AuthUser | null) => void): void
  addUserProfileChangeListener(callback: (userProfile: UserProfile | null) => void): () => void
  removeUserProfileChangeListener(callback: (userProfile: UserProfile | null) => void): void
  getAuthUser(): AuthUser | null
  getAuthToken(forceRefresh?: boolean): Promise<string>
  getUserProfile(forceRefresh?: boolean): Promise<UserProfile | null>
  login(email: string, password: string): Promise<AuthUser>
  // Create a Firebase account and sign in to it. Only the Firebase half of
  // sign-up: the account record is created by api.putUser afterwards.
  signUp(email: string, password: string): Promise<AuthUser>
  logout(): Promise<void>
  sendPasswordResetEmail(email: string): Promise<void>
  confirmPasswordReset(code: string, newPassword: string): Promise<void>
}

// ---------------------------------------------------------------------------
// MockFirestoreManager — in-memory document store. Reads return seeded data;
// `listenToDoc` calls back with the current value and again after every
// write to that doc, like onSnapshot; writes update the in-memory map. A doc
// that doesn't exist yet first calls back when it is written, which is how a
// test holds back a snapshot that a real listener would deliver later.
// ---------------------------------------------------------------------------

type DocMap = Record<string, Record<string, DocumentData>>

export class MockFirestoreManager implements IFirestoreManager {
  private readonly docs: DocMap
  private readonly docListeners = new Map<string, Set<(data: DocumentData | null) => void>>()

  constructor(seedDocs: Record<string, Record<string, Record<string, unknown>>> = {}) {
    // Shallow-clone per collection so test mutations don't leak into the
    // caller-owned seed object.
    const cloned: DocMap = {}
    for (const [coll, byId] of Object.entries(seedDocs)) {
      cloned[coll] = { ...byId } as Record<string, DocumentData>
    }
    this.docs = cloned
  }

  async getDocData<T extends DocumentData = DocumentData>(collectionName: string, docId: string): Promise<T | null> {
    const doc = this.docs[collectionName]?.[docId]
    return (doc as T) ?? null
  }

  async setDocData<T extends DocumentData = DocumentData>(
    collectionName: string,
    docId: string,
    data: T,
  ): Promise<void> {
    if (!this.docs[collectionName]) {
      this.docs[collectionName] = {}
    }
    this.docs[collectionName][docId] = data
    this.notify(collectionName, docId)
  }

  async mergeDocData<T extends DocumentData = DocumentData>(
    collectionName: string,
    docId: string,
    data: Partial<T>,
  ): Promise<void> {
    if (!this.docs[collectionName]) {
      this.docs[collectionName] = {}
    }
    const existing = this.docs[collectionName][docId] ?? {}
    this.docs[collectionName][docId] = { ...existing, ...data }
    this.notify(collectionName, docId)
  }

  listenToDoc<T extends DocumentData = DocumentData>(
    collectionName: string,
    docId: string,
    callback: (data: T | null) => void,
  ): Unsubscribe {
    // Fire synchronously with the current value if there is one, then on
    // every write.
    const path = `${collectionName}/${docId}`
    const listener = (data: DocumentData | null) => callback(data as T | null)
    const listeners = this.docListeners.get(path) ?? new Set()
    this.docListeners.set(path, listeners)
    listeners.add(listener)
    const doc = this.docs[collectionName]?.[docId]
    if (doc) {
      listener(doc)
    }
    return () => {
      listeners.delete(listener)
    }
  }

  private notify(collectionName: string, docId: string) {
    const doc = this.docs[collectionName]?.[docId] ?? null
    this.docListeners.get(`${collectionName}/${docId}`)?.forEach((listener) => listener(doc))
  }

  async queryDocs<T extends DocumentData = DocumentData>(
    collectionName: string,
    filters: QueryFilter[],
  ): Promise<QuerySnapshot<T>> {
    // Filters are ANDed, matching Firestore. Equality is compared with
    // Object.is so a doc missing the field simply doesn't match, rather than
    // matching an `undefined` value.
    //
    // This used to return every doc regardless of filters, which made it
    // impossible to seed two documents in one collection and have them resolve
    // separately — every lookup got the first one. That blocked several
    // fitting-room tests needing two distinct products.
    const entries = Object.values(this.docs[collectionName] ?? {}).filter((data) =>
      filters.every((filter) => Object.is((data as DocumentData)[filter.field], filter.value)),
    )
    const docs = entries.map((data) => ({ data: () => data as T }))
    const snapshot = {
      empty: docs.length === 0,
      docs,
      forEach: (cb: (doc: { data: () => T }) => void) => docs.forEach(cb),
    }
    return snapshot as unknown as QuerySnapshot<T>
  }
}

// ---------------------------------------------------------------------------
// MockAuthManager — listener-on-add semantics match AuthManager line-for-line
// (see src/lib/firebase.ts:149-167). The store wiring in src/index.tsx relies
// on the immediate-invoke behaviour on `addAuthStateChangeListener` and
// `addUserProfileChangeListener` to publish initial state, so the mock must
// preserve it exactly.
// ---------------------------------------------------------------------------

interface MockAuthSeed {
  uid: string
  email: string
  idToken: string
}

function makeMockAuthUser(seed: MockAuthSeed): AuthUser {
  // The real SDK only reads `uid`, `email`, and `getIdToken()` off the User
  // object — see firebase.ts:151,174,182,193. The cast-through-unknown keeps
  // the surface honest about what the mock actually provides.
  const fake = {
    uid: seed.uid,
    email: seed.email,
    getIdToken: async (_forceRefresh?: boolean) => seed.idToken,
  }
  return fake as unknown as AuthUser
}

export class MockAuthManager implements IAuthManager {
  private seed: MockAuthSeed | null
  private readonly accounts: MockAuthSeed[]
  private currentUser: AuthUser | null
  private userProfile: UserProfile | null = null
  private readonly firestore: IFirestoreManager
  private readonly authStateChangeListeners: Set<(authUser: AuthUser | null) => void> = new Set()
  private readonly userProfileChangeListeners: Set<(userProfile: UserProfile | null) => void> = new Set()
  private profileUnsub: Unsubscribe | null = null

  constructor(seed: MockAuthSeed | null, firestore: IFirestoreManager, accounts: MockAuthSeed[] = []) {
    this.seed = seed
    this.accounts = accounts
    this.currentUser = seed ? makeMockAuthUser(seed) : null
    this.firestore = firestore

    // Mirror the real AuthManager constructor: register the internal handler,
    // which immediately invokes for the current user and sets up the profile
    // listener BEFORE any external `addUserProfileChangeListener` arrives.
    this.addAuthStateChangeListener((authUser) => this.handleAuthStateChanged(authUser))
  }

  addAuthStateChangeListener(callback: (authUser: AuthUser | null) => void): () => void {
    this.authStateChangeListeners.add(callback)
    callback(this.currentUser)
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
    return this.currentUser
  }

  async getAuthToken(_forceRefresh: boolean = false): Promise<string> {
    if (!this.currentUser || !this.seed) {
      throw new Error('No authenticated user')
    }
    return this.seed.idToken
  }

  async getUserProfile(_forceRefresh: boolean = false): Promise<UserProfile | null> {
    return this.userProfile
  }

  async login(email: string, _password: string): Promise<AuthUser> {
    const account = this.accounts.find((a) => a.email === email)
    if (!account) {
      throw new Error(`MockAuthManager.login: no account for ${email} in InitParams.testHooks.accounts`)
    }
    const user = makeMockAuthUser(account)
    this.seed = account
    this.currentUser = user
    this.authStateChangeListeners.forEach((cb) => cb(user))
    return user
  }

  // Signs up a new account with uid `signup-<email>`, which a test can use to
  // write the profile the backend would sync. An email that already has an
  // account (the seeded user or testHooks.accounts) fails like Firebase does.
  async signUp(email: string, _password: string): Promise<AuthUser> {
    const taken = [this.seed, ...this.accounts].some((a) => a?.email === email)
    if (taken) {
      throw Object.assign(new Error('Firebase: Error (auth/email-already-in-use).'), {
        code: 'auth/email-already-in-use',
      })
    }
    const account = { uid: `signup-${email}`, email, idToken: `mock-signup-token-${email}` }
    this.accounts.push(account)
    const user = makeMockAuthUser(account)
    this.seed = account
    this.currentUser = user
    this.authStateChangeListeners.forEach((cb) => cb(user))
    return user
  }

  async logout(): Promise<void> {
    if (this.profileUnsub) {
      this.profileUnsub()
      this.profileUnsub = null
    }
    this.currentUser = null
    this.userProfile = null
    this.authStateChangeListeners.forEach((cb) => cb(null))
    this.userProfileChangeListeners.forEach((cb) => cb(null))
  }

  async sendPasswordResetEmail(_email: string): Promise<void> {
    // No-op: tests that need to assert "email sent" should spy on this method
    // via the network mock layer if/when needed.
  }

  async confirmPasswordReset(_code: string, _newPassword: string): Promise<void> {
    // No-op for parity with sendPasswordResetEmail.
  }

  private handleAuthStateChanged(authUser: AuthUser | null) {
    if (this.profileUnsub) {
      this.profileUnsub()
      this.profileUnsub = null
    }
    if (authUser) {
      logger.logDebug('Mock user logged in:', { uid: authUser.uid })
      this.profileUnsub = this.firestore.listenToDoc<UserProfile>('users', authUser.uid, (profile) => {
        this.userProfile = profile
        this.userProfileChangeListeners.forEach((cb) => cb(this.userProfile))
      })
      // Intentionally skip the user_logging write — tests don't exercise login
      // throttling and a tolerant no-op keeps fixtures simpler.
    } else {
      this.userProfile = null
      this.userProfileChangeListeners.forEach((cb) => cb(null))
    }
  }
}
