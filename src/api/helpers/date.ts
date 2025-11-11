import dayjs from 'dayjs/esm'

export type FirebaseDate = {
  nanoseconds: number
  seconds: number
}

export const fromFirebaseDate = (date: FirebaseDate) => {
  return dayjs(date.seconds * 1000)
}
