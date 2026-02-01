import { Size } from '@/lib/api'

export function getSizeLabelFromSize(size: Size): string | null {
  if (size.label) {
    return size.label
  }
  return size.size_value?.name ?? null
}
