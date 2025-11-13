import { InitImageSlider } from './virtualTryOnSlider'

export class VtoComponent {
  private isInit = false
  private currentSliderValue: number = 0
  private slider: ReturnType<typeof InitImageSlider> = null

  constructor(private readonly vtoMainDivId: string) { }

  public init() {
    if (this.isInit) return

    const vtoMainDiv = document.getElementById(this.vtoMainDivId)

    if (!vtoMainDiv) {
      const newDiv = document.createElement('div')
      newDiv.id = this.vtoMainDivId
      newDiv.style.display = 'block'
      document.body.appendChild(newDiv)
    }

    const targetDiv = document.getElementById(this.vtoMainDivId)!

    targetDiv.innerHTML = `
        <div class="tfr-slider-wrapper">
          <img id="tfr-tryon-image" src="" style="max-width: 30vw; display: block;" />
          <input type="range" id="tfr-slider" />
        </div>
    `

    // Make sure the div is visible
    targetDiv.style.display = 'block'
    targetDiv.style.visibility = 'visible'

    const tryOnImage = <HTMLImageElement>document.getElementById('tfr-tryon-image')
    const onChange = (slider, imageUrl) => {
      tryOnImage.src = imageUrl
      this.currentSliderValue = parseInt(slider.value)
    }

    this.slider = InitImageSlider('tfr-slider', onChange)
    this.isInit = true
    console.log('VTO Component initialized successfully')
  }

  public onNewFramesReady(frames: string[]) {
    if (!this.isInit) {
      this.init()
    }

    if (Array.isArray(frames) && frames.length > 0) {
      const boundedValue = Math.min(this.currentSliderValue, frames.length - 1)
      const e = this.slider.Load(frames, boundedValue)
      if (e instanceof Error) {
        console.error(e)
        return
      }

      const sliderElement = document.getElementById('tfr-slider') as HTMLInputElement
      if (sliderElement && this.currentSliderValue < frames.length) {
        sliderElement.value = this.currentSliderValue.toString()
        const tryOnImage = <HTMLImageElement>document.getElementById('tfr-tryon-image')
        tryOnImage.src = frames[this.currentSliderValue]
      }
    }
  }
}
