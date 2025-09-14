import { useAuthContext } from '@contexts/auth-context'

import { SizeRecFitTableLoggedIn } from './size-rec-fit-table-logged-in'
import { SizeRecFitTableLoggedOut } from './size-rec-fit-table-logged-out'

export const SizeRecFitTable = () => {
  const { isLoggedIn } = useAuthContext()

  return <>{isLoggedIn ? <SizeRecFitTableLoggedIn /> : <SizeRecFitTableLoggedOut />}</>
}
