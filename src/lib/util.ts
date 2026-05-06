import { Size } from '@/lib/api'

export function getSizeLabelFromSize(size: Size): string | null {
  if (size.label) {
    return size.label
  }
  return size.size_value?.name ?? null
}

// Frame URLs in Firestore are stored as full URLs pointing at the environment
// they were generated in (e.g. assets.dev.thefittingroom.xyz). At the point of
// use we strip the host (if present) and prepend the configured base for the
// current environment. Bare paths pass through with the base prepended, for
// forward-compat with future backend changes that may store pathnames only.
export function applyFrameBaseUrl(url: string, baseUrl: string): string {
  const cleanBase = baseUrl.replace(/\/+$/, '')
  if (/^https?:\/\//i.test(url)) {
    const parsed = new URL(url)
    return `${cleanBase}${parsed.pathname}${parsed.search}${parsed.hash}`
  }
  return `${cleanBase}${url.startsWith('/') ? '' : '/'}${url}`
}
