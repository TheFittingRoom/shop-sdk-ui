import i18n from 'i18next'
import { initReactI18next, useTranslation } from 'react-i18next'
import en from '@/locale/en.json'
import fr from '@/locale/fr.json'

void i18n.use(initReactI18next).init({
  lng: 'en',
  fallbackLng: 'en',
  resources: {
    en: { translation: en },
    fr: { translation: fr },
  },
  interpolation: {
    // React already escapes children as text at render time — leaving
    // i18next's default HTML-entity escaping on double-encodes any
    // interpolated value that happens to contain '<', '>', '/', '&',
    // '"' or "'". Manifested as e.g. "Recommended Size: S&#x2F;32" for
    // container parent-size labels like "S/32". Turning i18next's
    // escape off is safe because every consumer (LinkT, TextT,
    // ButtonT) drops the translated string into a React children
    // slot, not innerHTML.
    escapeValue: false,
  },
})

export { i18n, useTranslation }
