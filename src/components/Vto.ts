import { InitImageSlider } from './slider'

export class VtoComponent {
  private isInit = false
  private currentSliderValue: number = 0
  private slider: ReturnType<typeof InitImageSlider> = null

  constructor(private readonly vtoMainDivId: string) {}

  public init() {
    if (this.isInit) return

    const vtoMainDiv = document.getElementById(this.vtoMainDivId)

    if (!vtoMainDiv) throw new Error(`Element with id ${this.vtoMainDivId} not found`)

    vtoMainDiv.innerHTML = `
        <div class="tfr-slider-wrapper">
          <img id="tfr-tryon-image" src="" />
          <input type="range" id="tfr-slider" />
        </div>
    `

    const tryOnImage = <HTMLImageElement>document.getElementById('tfr-tryon-image')
    const onChange = (slider, imageUrl) => {
      console.debug('slider change', slider, imageUrl)
      tryOnImage.src = imageUrl
      this.currentSliderValue = parseInt(slider.value)
    }

    this.slider = InitImageSlider('tfr-slider', onChange)
    this.isInit = true
  }

  public onNewFramesReady(frames: string[]) {
    if (!this.isInit) {
      this.init()
    }

    if (Array.isArray(frames) && frames.length > 0) {
      // Ensure the current slider value is within bounds of the new frames array
      const boundedValue = Math.min(this.currentSliderValue, frames.length - 1)
      const e = this.slider.Load(frames, boundedValue)
      if (e instanceof Error) {
        console.error(e)
        return
      }

      // Restore previous slider position if it's within bounds
      const sliderElement = document.getElementById('tfr-slider') as HTMLInputElement
      if (sliderElement && this.currentSliderValue < frames.length) {
        sliderElement.value = this.currentSliderValue.toString()
        const tryOnImage = <HTMLImageElement>document.getElementById('tfr-tryon-image')
        tryOnImage.src = frames[this.currentSliderValue]
      }
    }
  }
}
