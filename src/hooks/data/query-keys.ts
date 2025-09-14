export const queryKeys = {
  auth: {
    all: ['auth'] as const,
    status: () => [...queryKeys.auth.all, 'status'] as const,
    profile: () => [...queryKeys.auth.all, 'profile'] as const,
  },

  style: {
    all: ['style'] as const,
    bySku: (sku: string) => [...queryKeys.style.all, 'sku', sku] as const,
    byBrandId: (brandId: string) => [...queryKeys.style.all, 'brand', brandId] as const,
    details: (id: string | number) => [...queryKeys.style.all, 'details', id] as const,
  },

  garment: {
    all: ['garment'] as const,
    locations: (sku: string, filledLocations?: string[]) =>
      [...queryKeys.garment.all, 'locations', sku, filledLocations] as const,
    locationsBySku: (sku: string) => [...queryKeys.garment.all, 'locations-sku', sku] as const,
    locationsByBrandId: (brandId: string | number) => [...queryKeys.garment.all, 'locations-brand', brandId] as const,
  },

  recommendation: {
    all: ['recommendation'] as const,
    sizes: (styleId: string | number) => [...queryKeys.recommendation.all, 'sizes', styleId] as const,
  },

  vto: {
    all: ['vto'] as const,
    frames: (styleId: number, sizeId: number) => [...queryKeys.vto.all, 'frames', styleId, sizeId] as const,
  },

  user: {
    all: ['user'] as const,
    profile: () => [...queryKeys.user.all, 'profile'] as const,
    measurements: () => [...queryKeys.user.all, 'measurements'] as const,
    preferences: () => [...queryKeys.user.all, 'preferences'] as const,
  },

  colorway: {
    all: ['colorway'] as const,
    sizeAsset: (sku: string) => [...queryKeys.colorway.all, 'size-asset', sku] as const,
  },
} as const

export type QueryKeys = typeof queryKeys
