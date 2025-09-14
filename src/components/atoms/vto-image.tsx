interface VtoImageProps {
  id?: string
  src: string
  alt: string
  loading?: 'lazy' | 'eager'
  onLoad?: () => void
  onError?: () => void
  className?: string
  width?: number | string
  height?: number | string
}

export const VtoImage = ({
  id,
  src,
  alt,
  loading = 'lazy',
  onLoad,
  onError,
  className = '',
  width,
  height,
}: VtoImageProps) => {
  return (
    <img
      id={id}
      src={src}
      alt={alt}
      loading={loading}
      onLoad={onLoad}
      onError={onError}
      className={`tfr-vto-image ${className}`}
      width={width}
      height={height}
    />
  )
}
