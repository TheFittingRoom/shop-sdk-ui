import { AvatarStatusCreated, AvatarStatusNotCreated, AvatarStatusPending } from '../generated/api/enums'

export { TFRShop, initShop } from './shop'
export * from './measurement'

export type TryOnFrames = string[]

export const AvatarState = {
  NOT_CREATED: AvatarStatusNotCreated,
  CREATED: AvatarStatusCreated,
  PENDING: AvatarStatusPending,
} as const

export type AvatarState = (typeof AvatarState)[keyof typeof AvatarState]

export type {
  FirestoreColorwaySizeAsset,
  FirestoreGarmentMeasurement,
  FirestoreSize,
  FirestoreColorway,
  FirestoreStyle,
  FirestoreUser,
  FirestoreStyleGarmentCategory,
  FirestoreStyleCategory,
  FirestoreMeasurementLocation as FirestoreGarmentMeasurementLocation,
} from '../generated/api/responses'
