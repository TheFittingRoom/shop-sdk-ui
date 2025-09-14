import type { TfrShop } from '@thefittingroom/sdk'
import { useEffect, useState } from 'preact/hooks'

export const useTfrAuth = (tfrShop: TfrShop) => {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [isChecking, setIsChecking] = useState(true)

  useEffect(() => {
    const checkLogin = async () => {
      try {
        const loggedIn = await tfrShop.onInit()
        setIsLoggedIn(loggedIn)
      } catch (err) {
        console.error('Failed to check login status:', err)
        setIsLoggedIn(false)
      } finally {
        setIsChecking(false)
      }
    }
    checkLogin()
  }, [tfrShop])

  return {
    isLoggedIn,
    isChecking,
  }
}
