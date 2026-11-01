import { getDemoAvatar, putUserGender } from '@/lib/api'
import { getLogger } from '@/lib/logger'
import { useMainStore } from '@/lib/store'
import type { DemoGender } from '@/lib/user-avatar'

const logger = getLogger('demo-avatar')

const loading = new Set<DemoGender>()

// loadDemoAvatarFrames fetches the demo avatar for gender into the store,
// once. Its frames are not on the shopper's own Firestore doc: the backend
// keeps them off it, because the mobile app shows users/{uid}.avatar_frames
// as the user's own avatar.
function loadDemoAvatarFrames(gender: DemoGender) {
  if (useMainStore.getState().demoAvatarFrames[gender] || loading.has(gender)) {
    return
  }
  loading.add(gender)
  getDemoAvatar(gender)
    .then((demo) => useMainStore.getState().setDemoAvatarFrames(gender, demo.frames))
    .catch((error) => logger.logError('Failed to load the demo avatar', { gender, error }))
    .finally(() => loading.delete(gender))
}

// _init loads the demo avatar's frames whenever the shopper is borrowing one.
export function _init() {
  const load = () => {
    const avatar = useMainStore.getState().userAvatar
    if (avatar?.kind === 'demo') {
      loadDemoAvatarFrames(avatar.gender)
    }
  }
  load()
  useMainStore.subscribe((state, prevState) => {
    if (state.userAvatar !== prevState.userAvatar) {
      load()
    }
  })
}

// useAvatarFrames returns the bare frame paths of the avatar the shopper is
// trying on with — their own, or the demo avatar — or null while they aren't
// known yet.
export function useAvatarFrames(): string[] | null {
  return useMainStore((state) => {
    const avatar = state.userAvatar
    if (avatar?.kind === 'own') {
      const frames = state.userProfile?.avatar_frames
      return frames && frames.length > 0 ? frames : null
    }
    if (avatar?.kind === 'demo') {
      return state.demoAvatarFrames[avatar.gender] ?? null
    }
    return null
  })
}

// useIsDemoAvatar is true while the shopper is trying on with the demo avatar:
// the try-on images say so (DEMO AVATAR watermark) and the overlays offer
// "Create your Mini Me".
export function useIsDemoAvatar(): boolean {
  return useMainStore((state) => state.userAvatar?.kind === 'demo')
}

// chooseDemoGender saves the shopper's gender, which picks their demo avatar.
// The profile is updated locally straight away rather than waiting for the
// backend's Firestore sync, so the try-on can start; the synced doc that
// follows carries the same value.
export async function chooseDemoGender(gender: DemoGender): Promise<void> {
  await putUserGender(gender)
  const { userProfile, setUserProfile } = useMainStore.getState()
  if (userProfile) {
    setUserProfile({ ...userProfile, gender })
  }
}
