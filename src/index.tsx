import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { OverlayManager } from '@/components/overlay-manager'
import { Widget } from '@/components/widget'
import { EnvName } from '@/lib/config'
import { _init as initFirebase, getAuthManager } from '@/lib/firebase'
import { useMainStore } from '@/lib/store'

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
  environment: EnvName
}

export async function init({ brandId, environment }: InitParams) {
  // Validate init params
  if (!brandId || typeof brandId !== 'number' || isNaN(brandId) || brandId <= 0) {
    throw new Error(`TFR: Invalid brandId "${brandId}"`)
  }
  if (!Object.values(EnvName).includes(environment)) {
    throw new Error(`TFR: Invalid environment "${environment}"`)
  }

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

  // Initialize Firebase, Firestore, Auth
  await initFirebase(environment, brandId)

  // Publish user state to store
  const authManager = getAuthManager()
  authManager.addAuthStateChangeListener((authUser) => {
    useMainStore.getState().setUserIsLoggedIn(!!authUser)
  })
  authManager.addUserProfileChangeListener((userProfile) => {
    useMainStore.getState().setUserProfile(userProfile)
  })

  console.log('[TFR] SDK initialized')
}

export const TFR = {
  init,
}
