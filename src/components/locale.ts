import en from '../languages/en.json'
import fr from '../languages/fr.json'
import { createUIError } from './uiError'

/// <reference types="vite/client" />

const locales = { en, fr }

var L: any = en

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
    const data = locales[locale as keyof typeof locales]
    if (data) {
      const missingLocales = findMissingLocales(L, data)
      if (Object.keys(missingLocales.default).length > 0) {
        console.warn(`The following locales are missing from the new locale: ${JSON.stringify(missingLocales.default)}`)
      }
      if (Object.keys(missingLocales.new).length > 0) {
        console.warn(`The following locales are missing from the default locale: ${JSON.stringify(missingLocales.new)}`)
      }
      L = data
      resolve()
    } else {
      reject(createUIError(L.FailedToLoadLocale, new Error(`Locale ${locale} not found`)))
    }
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
