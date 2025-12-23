import { AvatarStatusCreated, AvatarStatusNotCreated, AvatarStatusPending, HorizontalFitLoose, HorizontalFitOversized, HorizontalFitPerfectFit, HorizontalFitSlightlyLoose, HorizontalFitSlightlyTight, HorizontalFitTight, HorizontalFitTooTight } from './gen/enums'

export { FittingRoomAPI } from './api'
export * from './measurement'

export type ColorwaySizeAssetFrameURLs = string[]

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
