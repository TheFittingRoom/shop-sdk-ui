import * as firebase from 'firebase/app'
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


export class FirebaseAuthUserController {
  private readonly initializationPromise: Promise<User | null>
  private readonly auth: Auth

  constructor(app: firebase.FirebaseApp,
  ) {
    this.auth = getAuth(app)
    this.auth.setPersistence(browserLocalPersistence)
    this.initializationPromise = this.resolveAuthStateChangeUser()
  }

  public ListenForAuthStateChange(
    isInit: boolean,
    callback: (user: User | null, isInit: boolean) => void,
    onError?: (error: Error) => void
  ): () => void {
    console.debug('listening for auth state changes...')
    return onAuthStateChanged(
      this.auth,
      (user) => {
        callback(user, isInit);
      },
      (error) => {
        console.error('Auth state listener error:', error)
        if (onError) {
          onError(error);
        }
      },
    )
  }

  private async resolveAuthStateChangeUser(): Promise<User | null> {
    console.debug('Resolving initial auth state...')
    return new Promise<User | null>((resolve) => {
      // Create a temporary listener just for the initial state
      const unsubscribe = this.ListenForAuthStateChange(false,
        (user) => {
          unsubscribe();
          resolve(user);
        },
        (error) => {
          console.error("resolveAuthStateChangeUser error:", error)
          unsubscribe();
          resolve(null);
        }
      );
    });
  }


  public async GetUserOrNotLoggedIn(): Promise<User> {
    await this.initializationPromise
    console.debug('GetUserOrNotLoggedIn:', Boolean(this.auth?.currentUser))
    return this.auth?.currentUser
  }

  public async GetToken(): Promise<string | Error> {
    return this.GetUserOrNotLoggedIn().then((user: User) => {
      return user.getIdToken(true)
    }).catch((error: Error) => {
      console.error(error)
      return Promise.reject(error)
    })
  }

  public async GetCurrentUser(): Promise<User | null> {
    console.debug('GetCurrentUser called, waiting for initialization...')
    const user = await this.initializationPromise
    console.debug('GetCurrentUser initialization complete, user found:', user ? user.email : 'No user')
    return user
  }

  public async Login(email: string, password: string): Promise<void> {
    await await this.initializationPromise

    // Check if already logged in with same email
    if (this.auth.currentUser && this.auth.currentUser.email === email) {
      console.debug('Skipping login since user is already logged in with same email')
      return
    }

    // Sign out existing user if different email
    if (this.auth.currentUser && this.auth.currentUser.email !== email) {
      await this.auth.signOut()
    }

    try {
      const userCredential = await signInWithEmailAndPassword(this.auth, email, password)
      console.debug('Login successful for user:', userCredential.user.email)
    } catch (error) {
      console.error('Login error:', error)
      throw error
    }
  }

  public async Logout(): Promise<void> {
    await this.initializationPromise

    try {
      await this.auth.signOut()
    } catch (error) {
      console.error('Logout error:', error)
      throw error
    }
  }

  public async SendPasswordResetEmail(email: string): Promise<void> {
    await sendPasswordResetEmail(this.auth, email)
  }

  public async ConfirmPasswordReset(code: string, newPassword: string): Promise<void> {
    await confirmPasswordReset(this.auth, code, newPassword)
  }
}
