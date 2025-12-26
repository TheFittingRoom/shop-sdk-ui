import { FirestoreStyle } from '@/api/gen/responses'
import { getFirestoreManager, where } from '@/lib/firebase'

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
