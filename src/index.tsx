import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Widget } from '@/components/widget'
// import { useTfrStore } from '@/lib/store'

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
    customElements.define('tfr-widget', TfrWidgetElement)
    // setInterval(() => {
    //   useTfrStore.getState().incrementCounter()
    // }, 2000)
    console.log('TFR SDK initialized')
  },
}
