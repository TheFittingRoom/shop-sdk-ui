import { Vto } from '@components/organisms/vto'
import { useVtoContext } from '@contexts/vto-context'

export const VtoPortal = () => {
  const vtoContext = useVtoContext()

  if (!vtoContext?.frames?.length) return null

  const { frames, currentFrameIndex, setCurrentFrame } = vtoContext

  return (
    <Vto
      frames={frames.map((f) => f.url)}
      currentFrameIndex={currentFrameIndex}
      onFrameChange={setCurrentFrame}
      preloadFrames={true}
      className="tfr-vto-container"
    />
  )
}
