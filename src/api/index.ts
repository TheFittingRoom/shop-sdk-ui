import { AvatarStatusCreated, AvatarStatusNotCreated, AvatarStatusPending } from './gen/enums'

export { FittingRoomAPI } from './api'
export * from './measurement'

export type TryOnFrames = string[]

export type {
  AvatarStatusCreated,
  AvatarStatusNotCreated,
  AvatarStatusPending
}

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
