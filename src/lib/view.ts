import Bowser from 'bowser'
import FittingRoomOverlay from '@/components/overlays/fitting-room'
import ForgotPasswordOverlay from '@/components/overlays/forgot-password'
import GetAppOverlay from '@/components/overlays/get-app'
import LandingOverlay from '@/components/overlays/landing'
import SignInOverlay from '@/components/overlays/sign-in'
import QuickViewOverlay from '@/components/overlays/quick-view'
import AddToFittingRoomCompactWidget from '@/components/widgets/add-to-fitting-room-compact'
import FittingRoomIconWidget from '@/components/widgets/fitting-room-icon'
import FittingRoomWidget from '@/components/widgets/fitting-room'
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
  ADD_TO_FITTING_ROOM_COMPACT = 'add-to-fitting-room-compact',
  FITTING_ROOM = 'fitting-room',
  FITTING_ROOM_ICON = 'fitting-room-icon',
  SIZE_REC = 'size-rec',
  VTO_BUTTON = 'vto-button',
}

export const WIDGETS: Record<WidgetName, React.FC<WidgetProps>> = {
  [WidgetName.ADD_TO_FITTING_ROOM_COMPACT]: AddToFittingRoomCompactWidget,
  [WidgetName.FITTING_ROOM]: FittingRoomWidget,
  [WidgetName.FITTING_ROOM_ICON]: FittingRoomIconWidget,
  [WidgetName.SIZE_REC]: SizeRecWidget,
  [WidgetName.VTO_BUTTON]: VtoButtonWidget,
}

export enum OverlayName {
  FITTING_ROOM = 'fitting-room',
  FORGOT_PASSWORD = 'forgot-password',
  GET_APP = 'get-app',
  LANDING = 'landing',
  SIGN_IN = 'sign-in',
  QUICK_VIEW = 'quick-view',
}

export type OverlayProps = Record<string, unknown>

export const OVERLAYS: Record<OverlayName, React.FC<OverlayProps>> = {
  [OverlayName.FITTING_ROOM]: FittingRoomOverlay,
  [OverlayName.FORGOT_PASSWORD]: ForgotPasswordOverlay,
  [OverlayName.GET_APP]: GetAppOverlay,
  [OverlayName.LANDING]: LandingOverlay,
  [OverlayName.SIGN_IN]: SignInOverlay,
  [OverlayName.QUICK_VIEW]: QuickViewOverlay,
}
