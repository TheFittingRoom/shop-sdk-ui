import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { OverlayManager } from '@/components/overlay-manager'
import { Widget } from '@/components/widget'
// import { useMainStore } from '@/lib/store'

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

export const TFR = {
  async init() {
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

    // Example of interacting with the store
    // setInterval(() => {
    //   useMainStore.getState().incrementCounter()
    // }, 2000)

    console.log('TFR SDK initialized')
  },
}
