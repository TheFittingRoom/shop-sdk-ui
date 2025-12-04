import { InitImageSlider } from './virtualTryOnSlider'

export class VTOController {
  private isShown = false
  private currentSliderValue: number = 0
  private slider: ReturnType<typeof InitImageSlider> = null
  private tryOnImage: HTMLImageElement | null = null
  private sliderElement: HTMLInputElement | null = null

  constructor(private vtoMainDiv: HTMLElement) {
    if (!vtoMainDiv) {
      throw new Error("vtoMainDiv is:" + vtoMainDiv)
    }
    vtoMainDiv.classList.add("hide")
  }

  public show() {
    if (this.isShown) return

    this.vtoMainDiv.innerHTML = `
        <div class="tfr-slider-wrapper">
          <img id="tfr-tryon-image" src="" style="max-width: 30vw; display: block;" />
          <input type="range" id="tfr-slider" />
        </div>
    `

    this.vtoMainDiv.classList.remove("hide")


    this.tryOnImage = this.vtoMainDiv.querySelector('#tfr-tryon-image') as HTMLImageElement
    this.sliderElement = this.vtoMainDiv.querySelector('#tfr-slider') as HTMLInputElement

    const onChange = (slider, imageUrl) => {
      this.tryOnImage!.src = imageUrl
      this.currentSliderValue = parseInt(slider.value)
    }

    this.slider = InitImageSlider('tfr-slider', onChange)
    this.isShown = true
  }

  public hide() {
    if (!this.isShown) return

    this.vtoMainDiv.classList.add("hide")

    this.slider = null
    this.tryOnImage = null
    this.sliderElement = null

    this.isShown = false
  }

  public onNewFramesReady(frames: string[]) {
    console.debug("onNewFramesReady", frames)
    if (!this.isShown) {
      this.show()
    }

    if (Array.isArray(frames) && frames.length > 0) {
      const boundedValue = Math.min(this.currentSliderValue, frames.length - 1)
      const e = this.slider.Load(frames, boundedValue)
      if (e instanceof Error) {
        console.error(e)
        return
      }

      if (this.sliderElement && this.currentSliderValue < frames.length) {
        this.sliderElement.value = this.currentSliderValue.toString()
        this.tryOnImage!.src = frames[this.currentSliderValue]
      }
    }
  }
}
