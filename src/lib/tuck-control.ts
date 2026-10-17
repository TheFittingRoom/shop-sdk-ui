import type { VtoTuckLabel } from '@/api/gen/enums'
import { VtoTuckLabelTopOverUnder } from '@/api/gen/enums'

// TuckControl is what the backend ruled for an outfit's tuck control: whether
// to show it, and which wording it uses. It comes from the VTO response
// (`tuck`) — the SDK holds no copy of the rules behind it.
export interface TuckControl {
  available: boolean
  label: VtoTuckLabel
}

// Where the control sits: the avatar pill, or the wider call-to-action button
// under ADD TO CART.
export type TuckControlPlacement = 'pill' | 'cta'

// tuckActionKey is the locale key for the tuck control. The control names the
// action it performs, so it reads from the state the outfit is NOT in.
//
// With a dress / full-body garment in the outfit the top goes over or under
// it rather than tucking into anything: untucked is "top over", tucked-in is
// "top under". Both placements share that wording.
export function tuckActionKey(label: VtoTuckLabel, untucked: boolean, placement: TuckControlPlacement): string {
  if (label === VtoTuckLabelTopOverUnder) {
    return untucked ? 'fitting_room.top_under' : 'fitting_room.top_over'
  }
  if (placement === 'cta') {
    return untucked ? 'fitting_room.try_it_tucked_in' : 'fitting_room.try_it_untucked'
  }
  return untucked ? 'fitting_room.tuck_in' : 'fitting_room.untuck'
}
