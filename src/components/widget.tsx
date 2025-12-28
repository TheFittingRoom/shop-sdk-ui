import { WIDGETS, WidgetName, WidgetProps } from '@/lib/view'

export function Widget({ attributes }: WidgetProps) {
  const { widget: widgetName } = attributes
  const WidgetComponent = WIDGETS[widgetName as WidgetName]
  if (!WidgetComponent) {
    return null
  }
  return <WidgetComponent attributes={attributes} />
}
