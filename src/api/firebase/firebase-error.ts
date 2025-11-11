import { FirebaseError } from 'firebase/app'
import { AuthErrorCodes } from 'firebase/auth'

export const getFirebaseError = (e: FirebaseError) => {
  switch (e.code) {
    case AuthErrorCodes.USER_DISABLED:
      throw new Error('account has been disabled')
    default:
      throw new Error(e.message)
  }
}
