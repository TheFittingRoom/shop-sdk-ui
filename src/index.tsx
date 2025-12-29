import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import Bowser from 'bowser'
import { OverlayManager } from '@/components/overlay-manager'
import { Widget } from '@/components/widget'
import { _init as initApi } from '@/lib/api'
import { _init as initAsset } from '@/lib/asset'
import { getConfig, EnvName } from '@/lib/config'
import { _init as initFirebase, getAuthManager } from '@/lib/firebase'
import { i18n } from '@/lib/locale'
import { _init as initStore, useMainStore } from '@/lib/store'
import { _init as initTheme, ThemeData } from '@/lib/theme'
import { getDeviceView } from '@/lib/view'

// Import styles
// @ts-ignore
import css from '@/style.css?inline'

class TfrWidgetElement extends HTMLElement {
  connectedCallback() {
    const attributes = this.getAttributeNames().reduce(
      (attrs, name) => {
        attrs[name] = this.getAttribute(name)
        return attrs
      },
      {} as Record<string, any>,
    )

    const root = createRoot(this)
    root.render(
      <StrictMode>
        <Widget attributes={attributes} />
      </StrictMode>,
    )
  }
}

export interface InitParams {
  brandId: number
  productExternalId: string | number
  environment: EnvName
  lang?: string | null
  theme?: Partial<ThemeData> | null
}

export async function init({ brandId, productExternalId, environment, lang = null, theme = null }: InitParams) {
  // Validate init params
  if (!brandId || typeof brandId !== 'number' || isNaN(brandId) || brandId <= 0) {
    throw new Error(`TFR: Invalid brandId "${brandId}"`)
  }
  if (!productExternalId || (typeof productExternalId !== 'string' && typeof productExternalId !== 'number')) {
    throw new Error(`TFR: Invalid productExternalId "${productExternalId}"`)
  }
  if (!Object.values(EnvName).includes(environment)) {
    throw new Error(`TFR: Invalid environment "${environment}"`)
  }

  // Get config
  const config = getConfig(environment)

  // Get device info
  let isMobileDevice: boolean
  {
    const bowserParser = Bowser.getParser(window.navigator.userAgent)
    isMobileDevice = bowserParser.getPlatformType(true) === 'mobile'
  }

  // Set language
  if (lang) {
    await i18n.changeLanguage(lang)
  }

  // Set static data
  initStore({
    brandId,
    productExternalId: String(productExternalId),
    environment,
    isMobileDevice,
    config,
  })

  // Initialize asset manager
  initAsset()

  // Set theme data
  initTheme(theme)

  // Publish device view to store
  {
    function updateDeviceView() {
      const deviceView = getDeviceView(isMobileDevice)
      useMainStore.getState().setDeviceView(deviceView)
    }
    updateDeviceView()
    window.addEventListener('resize', () => {
      updateDeviceView()
    })
  }

  // Initialize Firebase, Firestore, Auth
  await initFirebase()

  // Publish user state to store
  const authManager = getAuthManager()
  authManager.addAuthStateChangeListener((authUser) => {
    useMainStore.getState().setAuthUser(authUser)
  })
  authManager.addUserProfileChangeListener((userProfile) => {
    useMainStore.getState().setUserProfile(userProfile)
  })

  // Initialize api
  initApi()

  // Inject styles
  {
    const styleEl = document.createElement('style')
    styleEl.innerHTML = css
    document.head.appendChild(styleEl)
  }

  // Hydrate widget elements
  customElements.define('tfr-widget', TfrWidgetElement)

  // Inject overlay manager
  {
    const overlayManagerEl = document.createElement('div')
    document.body.appendChild(overlayManagerEl)
    const root = createRoot(overlayManagerEl)
    root.render(
      <StrictMode>
        <OverlayManager />
      </StrictMode>,
    )
  }

  console.log('[TFR] SDK initialized')
}

export const TFR = {
  init,
}
