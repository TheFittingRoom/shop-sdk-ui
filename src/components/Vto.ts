import { InitImageSlider } from './slider'

export class VtoComponent {
  private isInit = false

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

    this.isInit = true
  }

  public onNewFramesReady(frames: string[]) {
    const tryOnImage = <HTMLImageElement>document.getElementById('tfr-tryon-image')

    const onChange = (slider, imageUrl) => {
      console.debug('slider change', slider, imageUrl)
      tryOnImage.src = imageUrl
    }

    const slider = InitImageSlider('tfr-slider', onChange)

    if (Array.isArray(frames) && frames.length > 0) {
      const e = slider.Load(frames)
      if (e instanceof Error) {
        console.error(e)
        return
      }
    }
  }
}
