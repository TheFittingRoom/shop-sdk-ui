import { FirestoreStyle, FirestoreColorwaySizeAsset } from '@/api/gen/responses'
import { getFirestoreManager, where } from '@/lib/firebase'

export type { FirestoreStyle, FirestoreColorwaySizeAsset }

const recordCache: { [key: string]: unknown } = {}

export async function getStyleByExternalId(brandId: number, externalId: string): Promise<FirestoreStyle | null> {
  const cacheKey = `getStyleByExternalId/${brandId}/${externalId}`
  if (recordCache[cacheKey]) {
    return recordCache[cacheKey] as FirestoreStyle
  }

  const firestore = getFirestoreManager()
  const querySnapshot = await firestore.queryDocs<FirestoreStyle>('styles', [
    where('brand_id', '==', brandId),
    where('external_id', '==', externalId),
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
//     where('style_id', '==', styleId),
//   ])

//   const records: FirestoreColorwaySizeAsset[] = []
//   querySnapshot.forEach((doc) => {
//     records.push(doc.data())
//   })
//   recordCache[cacheKey] = records
//   return records
// }
