// In-memory Firebase Auth + Firestore replacements driven by InitParams.testHooks.
//
// Activated only when the SDK is initialized with `testHooks` set. Production
// callers MUST NOT set that field; it exists as a data hatch for the Playwright
// e2e suite so tests can run without real Firebase credentials or emulators.
//
// The branch that swaps real → mock lives in exactly one place: the top of
// `_init` in `src/lib/firebase.ts`. Nothing else in `src/` knows about test
// mode.

import type { DocumentData, QueryFieldFilterConstraint, QuerySnapshot, Unsubscribe } from 'firebase/firestore'
import type { AuthUser, UserProfile } from '@/lib/firebase'
import { getLogger } from '@/lib/logger'

const logger = getLogger('firebase-mock')

/**
 * Test-only data hatch. Production callers MUST NOT set `InitParams.testHooks`.
 *
 * `auth` omitted → simulates a logged-out shopper.
 * `auth.profile` provided → auto-seeds `firestore.docs.users[uid]` so callers
 * only need to specify the profile once.
 */
export interface TestHooks {
  auth?: {
    uid: string
    email: string
    idToken: string
    profile?: UserProfile
  }
  firestore?: {
    docs?: Record<string, Record<string, Record<string, unknown>>>
  }
}

// ---------------------------------------------------------------------------
// Interfaces — the public surface of the real managers. Both the real and the
// mock classes implement these; firebase.ts's module variables type against
// them so call sites stay unchanged regardless of which implementation is
// installed.
// ---------------------------------------------------------------------------

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
    constraints: QueryFieldFilterConstraint[],
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
  logout(): Promise<void>
  sendPasswordResetEmail(email: string): Promise<void>
  confirmPasswordReset(code: string, newPassword: string): Promise<void>
}

// ---------------------------------------------------------------------------
// MockFirestoreManager — in-memory document store. Reads return seeded data;
// `listenToDoc` calls back once with the current value and returns a no-op
// unsubscribe; writes update the in-memory map. No live-change simulation
// (good enough for the v1 e2e suite).
// ---------------------------------------------------------------------------

type DocMap = Record<string, Record<string, DocumentData>>

export class MockFirestoreManager implements IFirestoreManager {
  private readonly docs: DocMap

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
  }

  listenToDoc<T extends DocumentData = DocumentData>(
    collectionName: string,
    docId: string,
    callback: (data: T | null) => void,
  ): Unsubscribe {
    // Fire once synchronously with the current value; no live updates.
    const doc = this.docs[collectionName]?.[docId]
    callback((doc as T) ?? null)
    return () => {
      /* no-op unsubscribe */
    }
  }

  async queryDocs<T extends DocumentData = DocumentData>(
    collectionName: string,
    _constraints: QueryFieldFilterConstraint[],
  ): Promise<QuerySnapshot<T>> {
    // Ignore the constraints — return every doc in the collection. v1 tests
    // don't exercise filtering, and the caller surface we ship (database.ts)
    // only reads `.empty`, `.docs[].data()`, and `.forEach()`.
    const entries = Object.values(this.docs[collectionName] ?? {})
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
  private readonly seed: MockAuthSeed | null
  private currentUser: AuthUser | null
  private userProfile: UserProfile | null = null
  private readonly firestore: IFirestoreManager
  private readonly authStateChangeListeners: Set<(authUser: AuthUser | null) => void> = new Set()
  private readonly userProfileChangeListeners: Set<(userProfile: UserProfile | null) => void> = new Set()
  private profileUnsub: Unsubscribe | null = null

  constructor(seed: MockAuthSeed | null, firestore: IFirestoreManager) {
    this.seed = seed
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

  async login(_email: string, _password: string): Promise<AuthUser> {
    throw new Error('MockAuthManager.login is not supported — seed the user via InitParams.testHooks.auth')
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
