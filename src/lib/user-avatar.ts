import type { UserProfile } from '@/lib/firebase'

// Which avatar a signed-in shopper tries on with (WEB-25).
//
// A shopper who has not scanned yet borrows a shared demo avatar for the
// gender they chose at sign-up. They never own it: the backend lends it for
// size recommendations and try-ons (tfr-backend `effectiveAvatar`), and their
// own scan replaces it simply by existing.
export type DemoGender = 'female' | 'male'

export type UserAvatar =
  // Their own avatar.
  | { kind: 'own' }
  // The demo avatar for `gender`, until they scan.
  | { kind: 'demo'; gender: DemoGender }
  // No avatar and no gender (an app account that never scanned): they have to
  // choose a demo avatar before they can try anything on.
  | { kind: 'needs_gender' }

export function isDemoGender(value: unknown): value is DemoGender {
  return value === 'female' || value === 'male'
}

// userAvatarFromProfile mirrors the backend's rule, so the frames shown and
// the avatar the backend renders on never disagree: own avatar when the
// shopper has a rendered one, else the demo avatar for their gender.
//
// "Has a rendered one" is avatar_frames being present, OR avatar_status
// CREATED. The status covers a gap in the frames: the avatar sync rewrites
// the whole user doc and adds avatar_frames back a moment later, and without
// it a shopper with an avatar (and a gender) would flicker to the demo one.
// The frames cover the other direction: during a re-scan the status is
// PENDING (or NOT_CREATED after a failed render) while their previous avatar
// is still theirs.
export function userAvatarFromProfile(profile: UserProfile): UserAvatar {
  if ((profile.avatar_frames?.length ?? 0) > 0 || profile.avatar_status === 'CREATED') {
    return { kind: 'own' }
  }
  if (isDemoGender(profile.gender)) {
    return { kind: 'demo', gender: profile.gender }
  }
  return { kind: 'needs_gender' }
}

export function canTryOn(avatar: UserAvatar | null): boolean {
  return avatar?.kind === 'own' || avatar?.kind === 'demo'
}

// avatarKey names the avatar the backend is currently rendering on for this
// shopper, so caches of its results (size recommendations, VTO frames) can be
// dropped when it changes. '' when it can't be told: no profile yet, or an
// own avatar whose frames are momentarily missing during an avatar sync.
//
// An own avatar is named by its first frame path, which embeds the user and
// avatar ids (user-<uid>/avatar-<id>/...). Only this user's frames count: a
// new uid can arrive while the store still holds the previous user's profile.
export function avatarKey(profile: UserProfile | null, uid: string | null): string {
  if (!profile || !uid) {
    return ''
  }
  const avatar = userAvatarFromProfile(profile)
  if (avatar.kind === 'demo') {
    return `demo:${avatar.gender}`
  }
  if (avatar.kind === 'own') {
    const frame = profile.avatar_frames?.[0] ?? ''
    return frame.startsWith(`user-${uid}/`) ? frame : ''
  }
  return ''
}

// AvatarKeyTracker reports when the avatar behind a shopper's results has
// been replaced, which is the moment cached results stop being valid.
//
// Only replacing one known avatar with another counts. The first key to
// arrive is the avatar they already had (results fetched while it was
// unknown were fetched for it), and a key going blank is passing (the avatar
// sync above), so neither is a change.
export class AvatarKeyTracker {
  private uid: string | null = null
  private key = ''

  // Returns true when the uid changed or one known avatar replaced another.
  update(uid: string | null, key: string): boolean {
    if (uid !== this.uid) {
      this.uid = uid
      this.key = key
      return true
    }
    if (!key || key === this.key) {
      return false
    }
    const replaced = this.key !== ''
    this.key = key
    return replaced
  }
}
