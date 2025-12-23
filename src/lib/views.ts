import VtoSingleOverlay from '@/components/overlays/vto-single'
import SizeRecWidget from '@/components/widgets/size-rec'
import VtoButtonWidget from '@/components/widgets/vto-button'

export interface WidgetProps {
  attributes: Record<string, any>
}

export enum OverlayName {
  VTO_SINGLE = 'vto-single',
}

export const OVERLAYS: Record<OverlayName, React.FC> = {
  [OverlayName.VTO_SINGLE]: VtoSingleOverlay,
}

export enum WidgetName {
  SIZE_REC = 'size-rec',
  VTO_BUTTON = 'vto-button',
}

export const WIDGETS: Record<WidgetName, React.FC<WidgetProps>> = {
  [WidgetName.SIZE_REC]: SizeRecWidget,
  [WidgetName.VTO_BUTTON]: VtoButtonWidget,
}
