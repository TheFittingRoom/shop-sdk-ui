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
import { _init as initLogger, getLogger, logInfo } from '@/lib/logger'
import { _init as initStore, useMainStore, ExternalProduct } from '@/lib/store'
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
  currentProduct: ExternalProduct
  environment: EnvName
  lang?: string | null
  theme?: Partial<ThemeData> | null
  debug: boolean | string | string[] | RegExp
}

export async function init(initParams: InitParams): Promise<boolean> {
  const logger = getLogger('init')
  try {
    const { brandId, currentProduct, environment, lang = null, theme = null, debug } = initParams

    // Validate init params
    if (!brandId || typeof brandId !== 'number' || isNaN(brandId) || brandId <= 0) {
      throw new Error(`Invalid brandId "${brandId}"`)
    }
    if (!currentProduct || typeof currentProduct.externalId !== 'string') {
      throw new Error('Invalid currentProduct')
    }
    if (!Object.values(EnvName).includes(environment)) {
      throw new Error(`Invalid environment "${environment}"`)
    }

    // Initialize logger
    initLogger(debug)
    logger.logDebug('Received initParams:', initParams)

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
      currentProduct,
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

    logger.logDebug('SDK initialized')
    return true
  } catch (error) {
    logger.logError('SDK initialization failed:', error)
    return false
  }
}

export async function logout() {
  const authManager = getAuthManager()
  await authManager.logout()
  logInfo('logout', 'User logged out')
}

const TFR = {
  init,
  logout,
}

export default TFR
