import { AvatarStatusCreated, AvatarStatusNotCreated, AvatarStatusPending } from './gen/enums'

export { FittingRoomAPI } from './api'
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
} from './gen/responses'
