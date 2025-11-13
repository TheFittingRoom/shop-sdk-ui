// Import CSS as strings and inject into the DOM
import colorsCSS from './colors.css?inline'
import fitModalCSS from './fit-modal.css?inline'
import generalCSS from './general.css?inline'
import inputCSS from './input.css?inline'
import loaderCSS from './loader.css?inline'
import mediaCSS from './media.css?inline'
import sizeRecCSS from './size-rec.css?inline'
import spacesCSS from './spaces.css?inline'
import telephoneCSS from './telephone.css?inline'
import textCSS from './text.css?inline'
import variablesCSS from './variables.css?inline'

// Combine all CSS
const allCSS = colorsCSS + fitModalCSS + generalCSS + inputCSS + loaderCSS + mediaCSS + sizeRecCSS + spacesCSS + telephoneCSS + textCSS + variablesCSS

// Inject CSS into the document head
if (typeof document !== 'undefined') {
  const styleElement = document.createElement('style')
  styleElement.id = 'thefittingroom-styles'
  styleElement.textContent = allCSS
  document.head.appendChild(styleElement)
}