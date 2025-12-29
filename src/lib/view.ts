import GetAppOverlay from '@/components/overlays/get-app'
import LandingOverlay from '@/components/overlays/landing'
import SignInOverlay from '@/components/overlays/sign-in'
import VtoSingleOverlay from '@/components/overlays/vto-single'
import SizeRecWidget from '@/components/widgets/size-rec'
import VtoButtonWidget from '@/components/widgets/vto-button'

export enum DeviceView {
  MOBILE = 'mobile',
  TABLET_LANDSCAPE = 'tablet-landscape',
  TABLET_PORTRAIT = 'tablet-portrait',
  DESKTOP = 'desktop',
}

export function getDeviceView(isMobileDevice: boolean): DeviceView {
  if (isMobileDevice) {
    return DeviceView.MOBILE
  }
  const { width, height } = window.screen
  const hasTouch = window.navigator.maxTouchPoints > 0
  if (hasTouch && width < 1400) {
    if (width > height) {
      return DeviceView.TABLET_LANDSCAPE
    }
    return DeviceView.TABLET_PORTRAIT
  }
  return DeviceView.DESKTOP
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
  GET_APP = 'get-app',
  LANDING = 'landing',
  SIGN_IN = 'sign-in',
  VTO_SINGLE = 'vto-single',
}

export type OverlayProps = Record<string, unknown>

export const OVERLAYS: Record<OverlayName, React.FC<OverlayProps>> = {
  [OverlayName.GET_APP]: GetAppOverlay,
  [OverlayName.LANDING]: LandingOverlay,
  [OverlayName.SIGN_IN]: SignInOverlay,
  [OverlayName.VTO_SINGLE]: VtoSingleOverlay,
}
