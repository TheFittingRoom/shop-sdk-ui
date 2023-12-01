import { createUIError } from './uiError'

var L = {
  AssociatedEmail: 'If there is an account associated with that email, We have sent a link to reset your password.',
  BackToSignIn: 'Back to sign in',
  BrandUserIdNotSet: 'User not logged in to brand site.',
  CreateAvatarSc: 'Scan the QR code/click link to download our app and create an avatar:',
  DontHaveAcc: "Don't have an account?",
  DontHaveAvatar: "Whoops! Looks like you don't have an avatar yet.",
  EmailAddress: 'Email address',
  EmailError: 'Please enter a valid email address.',
  EnterEmailAddress: 'Enter your email address, we will send you a link to reset your password.',
  EnterPhoneNumber: 'Enter your phone number to be texted a link to download The Fitting Room app.',
  FailedToLoadLocale: 'Something went wrong when fetching another language.',
  ForgotPassword: 'Forgot password',
  ForgotPasswordWithSymbol: 'Forgot password?',
  GetRecommendedSizesErrorText: 'Something went wrong while fetching sizes. Try again!',
  GetVirtualTryOnFramesErrorText: 'Something went wrong while fetching style id. Try again!',
  HaveAcc: 'Have an account? Sign in',
  HowItWorks: 'How it works',
  HowItWorksText:
    'The Fitting Room has partnered with your favourite designers to enable you to virtually try on garments, so you will know exactly how it will look before purchasing. Say good-bye to the days of dealing with returns!',
  Loading: 'Loading...',
  LoadingAvatar: 'Your avatar is loading...',
  ModalTitle: 'Enter your email address to be notified when The Fitting Room try on is offered on Google Play:',
  NoSizeAvailable: 'Unfortunately, that size is not available for try on.',
  Or: 'Or',
  OrSize: 'or',
  Password: 'Password',
  PasswordError: 'Please enter a valid password (at least 7 characters).',
  PhoneNumber: 'Phone number',
  ReturnToCatalogPage: 'Return to Catalog Page',
  ReturnToProductPage: 'Return to Product Page',
  ReturnToSignIn: 'Return to sign in',
  ReturnToSite: 'Return to site',
  ReturnToTfr: 'Please return to The Fitting Room app to create your avatar.',
  Send: 'Send',
  SendPasswordResetEmailErrorText: 'Something went wrong while sending password reset email. Try again!',
  SignBackIn: 'Sign back in',
  SignIn: 'Sign in',
  SignOut: 'Sign out',
  SignOutErrorText: 'Something went wrong while logging out. Try again!',
  SignUp: 'Sign up',
  SimplyScan: 'Simply scan,',
  SimplyScanText:
    'Download The Fitting Room app, create an account, follow the easy set up steps, and then scan yourself using just your smartphone to create your personal lifelike avatar.',
  SomethingIsWrongWithThisUser: 'Something is wrong with this user. Try to re-authenticate again!',
  SomethingWentWrong: 'Something went wrong. Try again!',
  StyleNotReadyForVTO: 'This style is not ready for virtual try on yet. Please check back later.',
  SuccessfullyLoggedOut: 'You have successfully logged out!',
  TheFittingRoom: 'The Fitting Room',
  TryOn: 'and try on.',
  TryOnText:
    'After creating your avatar, return here and sign in. We will use the measurements from your avatar to tell you which size will fit you best, as well as let you try the garment on - all without leaving your house!',
  UsernameOrPasswordEmpty: 'Username or password is empty.',
  UsernameOrPasswordIncorrect: 'Username or password is incorrect.',
  VirtualTryOnWith: 'Size recommendation with',
  WeRecommendSize: 'We recommend a size',
}

function findMissingLocales(defaultLocale: any, newLocale: any): { default: any; new: any } {
  const missingLocales = { default: {}, new: {} }
  for (const key in defaultLocale) {
    if (newLocale[key] === undefined) {
      missingLocales.default[key] = defaultLocale[key]
    }
  }
  for (const key in newLocale) {
    if (defaultLocale[key] === undefined) {
      missingLocales.new[key] = newLocale[key]
    }
  }
  return missingLocales
}

async function SetLocale(locale: string): Promise<void> {
  return new Promise((resolve, reject) => {
    fetch(`${process.env.LANGUAGE_URL}/${locale}.json`)
      .then((response) => {
        if (response.ok) {
          response
            .json()
            .then((data) => {
              const missingLocales = findMissingLocales(L, data)
              if (Object.keys(missingLocales.default).length > 0) {
                console.warn(
                  `The following locales are missing from the new locale: ${JSON.stringify(missingLocales.default)}`,
                )
              }
              if (Object.keys(missingLocales.new).length > 0) {
                console.warn(
                  `The following locales are missing from the default locale: ${JSON.stringify(missingLocales.new)}`,
                )
              }
              L = data
              resolve()
            })
            .catch((error) => {
              reject(createUIError(L.FailedToLoadLocale, error))
            })
        } else {
          response
            .text()
            .then((bodyText) => {
              reject(createUIError(L.FailedToLoadLocale, new Error(bodyText)))
            })
            .catch((error) => {
              reject(createUIError(L.FailedToLoadLocale, error))
            })
        }
      })
      .catch((error) => {
        reject(createUIError(L.FailedToLoadLocale, error))
      })
  })
}

const InitLocale = (): Promise<string> => {
  return new Promise((resolve, reject) => {
    const searchParams = new URL(window.location.href).searchParams
    const language = searchParams.get('language') || 'en'

    SetLocale(language)
      .then(() => {
        resolve(language)
      })
      .catch((error) => {
        reject(error)
      })
  })
}

//TODO: add OverrideLocale function that rewrites all non-empty keys in the new locale over the old locale

export { InitLocale, L, SetLocale }
