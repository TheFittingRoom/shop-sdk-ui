function loadImages(imageURLs: string[], initialIndex: number) {
  // Force load the initial visible frame
  if (imageURLs[initialIndex]) {
    const initialImg = new Image()
    initialImg.src = imageURLs[initialIndex]
  }

  // Eager load others via hidden DOM elements
  const container = document.createElement('div')
  container.style.display = 'none'
  document.body.appendChild(container)
  imageURLs.forEach((url, index) => {
    if (index !== initialIndex) {
      const img = document.createElement('img')
      img.src = url
      container.appendChild(img)
    }
  })
}

export const InitImageSlider = (sliderID: string, onChange: (slider: HTMLInputElement, imageUrl: string) => void) => {
  const slider = <HTMLInputElement>document.getElementById(sliderID)
  if (!slider) {
    throw new Error(`Slider with id ${sliderID} not found`)
  }

  return {
    Load(imageURLs: string[], initialValue?: number) {
      if (!Array.isArray(imageURLs) || !imageURLs.length) {
        console.debug('slider has no images to load')
        return new Error('slider has no images to load')
      }
      const defaultScrollValue = initialValue !== undefined ? initialValue : 0
      loadImages(imageURLs, defaultScrollValue)
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
