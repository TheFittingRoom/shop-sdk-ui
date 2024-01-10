import { createUIError } from './uiError'

var L = {
  AssociatedEmail: 'If there is an account associated with that email, We have sent a link to reset your password.',
  BackToSignIn: 'Back to sign in',
  BrandUserIdNotSet: 'User not logged in to brand site.',
  DontHaveAcc: "Don't have an account?",
  DontHaveAvatar: "Whoops! Looks like you don't have an avatar yet.",
  EmailAddress: 'Email address',
  EmailError: 'Please enter a valid email address.',
  EnterEmailAddress: 'Enter your email address, we will send you a link to reset your password.',
  EnterPhoneNumber: 'Enter your number for download link',
  FailedToLoadLocale: 'Something went wrong when fetching another language.',
  ForgotPasswordWithSymbol: 'Forgot password?',
  HaveAcc: 'Have an account? Sign in',
  Loading: 'Loading...',
  LoadingAvatar: 'Your avatar is loading...',
  NoSizeAvailable: 'Unfortunately, that size is not available for try on.',
  OrSize: 'or',
  Password: 'Password',
  PasswordError: 'Please enter a valid password (at least 7 characters).',
  PhoneNumber: 'Phone number',
  ReturnToCatalogPage: 'Return to Catalog Page',
  ReturnToProductPage: 'Return to Product Page',
  ReturnToSite: 'Return to site',
  ReturnToTfr: 'Please return to The Fitting Room app to create your avatar.',
  Send: 'Send',
  SignBackIn: 'Sign back in',
  SignIn: 'Sign in',
  SomethingWentWrong: 'Something went wrong. Try again!',
  SuccessfullyLoggedOut: 'You have successfully logged out!',
  TheFittingRoom: 'The Fitting Room',
  UsernameOrPasswordEmpty: 'Username or password is empty.',
  UsernameOrPasswordIncorrect: 'Username or password is incorrect.',

  // Modal
  ModalTagline: 'End size uncertainty with',
  ModalText:
    'Our technology captures your precise measurements, and considers things like fabric stretch and your individual physique for the perfect fit every time.',
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
