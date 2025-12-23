import SizeRec from '@/components/widgets/size-rec'
import VtoButton from '@/components/widgets/vto-button'
import { WidgetProps } from '@/lib/widget-types'

export const WIDGETS: Record<string, React.FC<WidgetProps>> = {
  'size-rec': SizeRec,
  'vto-button': VtoButton,
}

export function Widget({ attributes }: WidgetProps) {
  const { widget: widgetName } = attributes
  const WidgetComponent = WIDGETS[widgetName]
  if (!WidgetComponent) {
    return null
  }
  return <WidgetComponent attributes={attributes} />
}
