import type { FirestoreStyle, FirestoreColorwaySizeAsset } from '@/api/gen/responses'
import { getFirestoreManager } from '@/lib/firebase'

export type { FirestoreStyle, FirestoreColorwaySizeAsset }

const recordCache: { [key: string]: unknown } = {}

export async function getStyleByExternalId(brandId: number, externalId: string): Promise<FirestoreStyle | null> {
  const cacheKey = `getStyleByExternalId/${brandId}/${externalId}`
  if (recordCache[cacheKey]) {
    return recordCache[cacheKey] as FirestoreStyle
  }

  const firestore = getFirestoreManager()
  const querySnapshot = await firestore.queryDocs<FirestoreStyle>('styles', [
    { field: 'brand_id', op: '==', value: brandId },
    { field: 'external_id', op: '==', value: externalId },
  ])

  if (querySnapshot.empty) {
    return null
  }

  const record = querySnapshot.docs[0].data()
  recordCache[cacheKey] = record
  return record
}

// currently unused
// export async function getColorwaySizeAssetsByStyleId(styleId: number): Promise<FirestoreColorwaySizeAsset[]> {
//   const cacheKey = `getColorwaySizeAssetsByStyleId/${styleId}`
//   if (recordCache[cacheKey]) {
//     return recordCache[cacheKey] as FirestoreColorwaySizeAsset[]
//   }

//   const firestore = getFirestoreManager()
//   const querySnapshot = await firestore.queryDocs<FirestoreColorwaySizeAsset>('colorway_size_assets', [
//     { field: 'style_id', op: '==', value: styleId },
//   ])

//   const records: FirestoreColorwaySizeAsset[] = []
//   querySnapshot.forEach((doc) => {
//     records.push(doc.data())
//   })
//   recordCache[cacheKey] = records
//   return records
// }
