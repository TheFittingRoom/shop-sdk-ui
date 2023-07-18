function loadImageRecursive(imageURL, imageURLs) {
  let next = function () {
    if (imageURLs.length === 0) {
      return
    }
    loadImageRecursive(imageURLs.slice(-1), imageURLs.slice(0, -1))
  }
  var img = new Image()
  img.onload = next
  img.onerror = next
  img.src = imageURL
}

function loadImages(imageURLs) {
  loadImageRecursive(imageURLs.slice(-1), imageURLs.slice(0, -1))
}

const InitImageSlider = (sliderID: string, onChange: (slider: HTMLInputElement, imageUrl: string) => void) => {
  const slider = <HTMLInputElement>document.getElementById(sliderID)
  if (!slider) {
    throw new Error(`Slider with id ${sliderID} not found`)
  }

  return {
    Load(imageURLs: string[]) {
      if (!Array.isArray(imageURLs) || !imageURLs.length) {
        console.debug('slider has no images to load')
        return new Error('slider has no images to load')
      }
      loadImages(imageURLs)
      const defaultScrollValue = imageURLs?.length - 2
      slider.value = defaultScrollValue.toString()
      slider.max = (imageURLs.length - 1).toString()

      const handleSliderChange = () => {
        const currentValue = parseInt((<HTMLInputElement>slider).value)
        onChange(slider, imageURLs[currentValue])
      }

      onChange(slider, imageURLs[defaultScrollValue])
      slider.removeEventListener('input', handleSliderChange)
      slider.addEventListener('input', handleSliderChange)

      return () => {
        slider.removeEventListener('input', handleSliderChange)
      }
    },
  }
}

export default InitImageSlider
