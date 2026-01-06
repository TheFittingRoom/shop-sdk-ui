import Bowser from 'bowser'
import ForgotPasswordOverlay from '@/components/overlays/forgot-password'
import GetAppOverlay from '@/components/overlays/get-app'
import LandingOverlay from '@/components/overlays/landing'
import SignInOverlay from '@/components/overlays/sign-in'
import VtoSingleOverlay from '@/components/overlays/vto-single'
import SizeRecWidget from '@/components/widgets/size-rec'
import VtoButtonWidget from '@/components/widgets/vto-button'
import { useMainStore } from '@/lib/store'

export enum DeviceLayout {
  MOBILE_PORTRAIT = 'mobile-portrait',
  MOBILE_LANDSCAPE = 'mobile-landscape',
  TABLET_LANDSCAPE = 'tablet-landscape',
  TABLET_PORTRAIT = 'tablet-portrait',
  DESKTOP = 'desktop',
}

export function _init() {
  function getDeviceData() {
    const bowserParser = Bowser.getParser(window.navigator.userAgent)
    const { width, height } = window.screen

    const isMobileDevice = bowserParser.getPlatformType(true) === 'mobile'
    const isTouch = window.navigator.maxTouchPoints > 0
    const isPortrait = height >= width
    const isWide = width >= 1400

    if (isWide) {
      return { isMobileDevice, deviceLayout: DeviceLayout.DESKTOP }
    }
    if (isTouch) {
      if (isMobileDevice) {
        return { isMobileDevice, deviceLayout: isPortrait ? DeviceLayout.MOBILE_PORTRAIT : DeviceLayout.MOBILE_LANDSCAPE }
      }
      return { isMobileDevice, deviceLayout: isPortrait ? DeviceLayout.TABLET_PORTRAIT : DeviceLayout.TABLET_LANDSCAPE }
    }
    return { isMobileDevice, deviceLayout: DeviceLayout.DESKTOP }
  }
  function updateDeviceView() {
    const { isMobileDevice, deviceLayout } = getDeviceData()
    useMainStore.getState().setDevice({ isMobileDevice, deviceLayout })
  }
  updateDeviceView()
  window.addEventListener('resize', () => {
    updateDeviceView()
  })
}

export interface WidgetProps {
  attributes: Record<string, any>
}

export enum WidgetName {
  SIZE_REC = 'size-rec',
  VTO_BUTTON = 'vto-button',
}

export const WIDGETS: Record<WidgetName, React.FC<WidgetProps>> = {
  [WidgetName.SIZE_REC]: SizeRecWidget,
  [WidgetName.VTO_BUTTON]: VtoButtonWidget,
}

export enum OverlayName {
  FORGOT_PASSWORD = 'forgot-password',
  GET_APP = 'get-app',
  LANDING = 'landing',
  SIGN_IN = 'sign-in',
  VTO_SINGLE = 'vto-single',
}

export type OverlayProps = Record<string, unknown>

export const OVERLAYS: Record<OverlayName, React.FC<OverlayProps>> = {
  [OverlayName.FORGOT_PASSWORD]: ForgotPasswordOverlay,
  [OverlayName.GET_APP]: GetAppOverlay,
  [OverlayName.LANDING]: LandingOverlay,
  [OverlayName.SIGN_IN]: SignInOverlay,
  [OverlayName.VTO_SINGLE]: VtoSingleOverlay,
}
