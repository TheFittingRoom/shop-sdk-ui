import { WidgetProps } from '@/lib/widget-types'
import { useTfrStore } from '@/lib/store'

export default function SizeRec({}: WidgetProps) {
  const counter = useTfrStore((state) => state.counter)
  return <div>This is the size recommendation widget. Counter: {counter}</div>
}
