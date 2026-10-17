// cartErrorDetail pulls a shopper-readable reason out of an error thrown by the
// merchant's addToCart callback, or returns null when there isn't one.
//
// The callback is the store's code, so its errors have no fixed shape. What it
// usually carries is Shopify's cart API error body: the theme's tfr.js throws
// `[TFR] addToCart: /cart/add.js failed 422: <response body>`, and a 422 body
// looks like
//
//   {"status":422,"message":"Cart Error","description":"Cannot find variant"}
//
// `description` is the specific reason; `message` is a generic heading
// ("Cart Error"), so it is only used when there is no description. Anything
// else in the error text — the "[TFR] addToCart: ..." prefix, a stack, an
// error with no JSON in it at all — is developer detail, not for shoppers.
export function cartErrorDetail(error: unknown): string | null {
  const text = error instanceof Error ? error.message : typeof error === 'string' ? error : ''
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end <= start) {
    return null
  }
  try {
    const body: unknown = JSON.parse(text.slice(start, end + 1))
    if (!body || typeof body !== 'object') {
      return null
    }
    const { description, message } = body as { description?: unknown; message?: unknown }
    for (const value of [description, message]) {
      if (typeof value === 'string' && value.trim()) {
        return value.trim()
      }
    }
  } catch {
    // Not JSON after all.
  }
  return null
}
