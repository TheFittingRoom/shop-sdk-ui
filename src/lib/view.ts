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
  VTO_SINGLE = 'vto-single',
}

export const OVERLAYS: Record<OverlayName, React.FC> = {
  [OverlayName.VTO_SINGLE]: VtoSingleOverlay,
}
