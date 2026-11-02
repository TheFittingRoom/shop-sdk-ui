import type { Page } from '@playwright/test'
import { devices, expect, test } from '@playwright/test'
import type { FirestoreUser } from '../../src/api/gen/responses'
import { bootSdk } from './helpers/boot'
import { bootFittingRoom, phoneViewport, portraitFrames, quickViewBoot } from './helpers/try-on'
import { TEST_DEMO_USER_PROFILE, TEST_UID, TEST_USER_PROFILE } from './fixtures/seed'

// WEB-25: shoppers can sign up in the SDK and try on before they scan, with a
// demo avatar for their gender. They see it watermarked DEMO AVATAR, with a
// "Create your Mini Me" pill that leads to the app, until their own avatar
// arrives.

const MINI_ME = { name: 'Create your Mini Me' }

// The Firebase mocks fixtures/host.html exposes.
function writeUserDoc(page: Page, uid: string, data: FirestoreUser) {
  return page.evaluate(
    async ({ uid, data }) => {
      const mocks = (
        window as unknown as {
          __TFR_TEST_MOCKS__: { firestore: { setDocData(c: string, id: string, d: unknown): Promise<void> } }
        }
      ).__TFR_TEST_MOCKS__
      await mocks.firestore.setDocData('users', uid, data)
    },
    { uid, data },
  )
}

const watermark = (page: Page) => page.getByTestId('demo-watermark')

// expectWatermarkOnPicture: the nth watermark lies wholly on its image's
// picture — inside the frame as drawn with object-fit: contain, not in the
// letterbox bands around it — nothing covers any of it (a sheet, the edge of
// a scroll area, the edge of the screen), and it sits in the bottom-left
// corner of the part that can be seen.
async function expectWatermarkOnPicture(page: Page, nth = 0) {
  const mark = watermark(page).nth(nth)
  await expect(mark).toBeVisible()
  await expect
    .poll(() =>
      mark.evaluate((el) => {
        const img = el.parentElement?.querySelector('img')
        if (!img || !img.naturalWidth) {
          return 'no image'
        }
        const box = img.getBoundingClientRect()
        const scale = Math.min(box.width / img.naturalWidth, box.height / img.naturalHeight)
        const w = img.naturalWidth * scale
        const h = img.naturalHeight * scale
        const pic = {
          left: box.left + (box.width - w) / 2,
          top: box.top + (box.height - h) / 2,
          right: box.left + (box.width + w) / 2,
          bottom: box.top + (box.height + h) / 2,
        }
        const m = el.getBoundingClientRect()
        if (m.left < pic.left || m.right > pic.right || m.top < pic.top || m.bottom > pic.bottom) {
          return `off the picture: mark ${JSON.stringify(m)} picture ${JSON.stringify(pic)}`
        }
        // The watermark ignores pointer events, so what is "at" its corners is
        // whatever is drawn under or over it: that must be the image.
        for (const [x, y] of [
          [m.left + 1, m.top + 1],
          [m.right - 1, m.top + 1],
          [m.left + 1, m.bottom - 1],
          [m.right - 1, m.bottom - 1],
        ]) {
          if (document.elementFromPoint(x, y) !== img) {
            return `covered at ${x},${y}`
          }
        }
        // ...and in the corner of what can be seen of it: just past its inset
        // (12px) to the left and below, the visible picture has ended.
        const beyond = 16
        const shownAt = (x: number, y: number) =>
          x >= pic.left && x < pic.right && y >= pic.top && y < pic.bottom && document.elementFromPoint(x, y) === img
        if (shownAt(m.left - beyond, m.top + 1) || shownAt(m.left + 1, m.bottom + beyond)) {
          return `not in the corner: mark ${JSON.stringify(m)} picture ${JSON.stringify(pic)}`
        }
        return 'ok'
      }),
    )
    .toBe('ok')
}

// --- signed out ----------------------------------------------------------------

test('the landing screen plays the intro video, and offers a demo account, the app, and sign in', async ({ page }) => {
  await bootSdk(page, { loggedIn: false })
  await page.getByRole('button', { name: /quick view/i }).click()

  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText('Try before you scan with a demo avatar')).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Try it now, scan later' })).toBeVisible()
  await expect(dialog.getByText('OR', { exact: true })).toBeVisible()
  await expect(dialog.getByText('Sign in.')).toBeVisible()

  // The intro video: a poster with a play button, swapped for the video on
  // tap.
  await expect(dialog.locator('video')).toHaveCount(0)
  await dialog.getByRole('button', { name: 'Play the video' }).click()
  const video = dialog.locator('video')
  await expect(video).toHaveAttribute('src', /\/intro-video\.mp4$/)
  await expect(video).toHaveAttribute('poster', /\/intro-video-poster\.jpg$/)
  await expect(dialog.getByRole('button', { name: 'Play the video' })).toHaveCount(0)

  await dialog.getByRole('button', MINI_ME).click()
  await expect(page.getByRole('img', { name: 'QR Code' })).toBeVisible()
})

test('sign-up creates the account, then tries on with the demo avatar', async ({ page }) => {
  const putUserBodies: unknown[] = []
  const boot = quickViewBoot()
  await bootSdk(page, {
    loggedIn: false,
    ...boot,
    apiOverrides: {
      ...boot.apiOverrides,
      putUser: (route) => {
        putUserBodies.push(route.request().postDataJSON())
        return route.fulfill({ status: 201, json: {} })
      },
    },
  })
  await page.getByRole('button', { name: /quick view/i }).click()
  await page.getByRole('button', { name: 'Try it now, scan later' }).click()

  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText('You will be able to use this profile to create your Mini Me later.')).toBeVisible()

  // Everything is required.
  await dialog.getByRole('button', { name: 'Create account' }).click()
  await expect(dialog.getByText('Please enter a valid email address.')).toBeVisible()
  await expect(dialog.getByText('Password must be at least 6 characters.')).toBeVisible()
  await expect(dialog.getByText('Please enter your name.')).toBeVisible()
  await expect(dialog.getByText('Please choose male or female.')).toBeVisible()
  await expect(dialog.getByText('You must be 18 or older.')).toBeVisible()
  await expect(dialog.getByText('Please accept the Terms of Service and Privacy Policy.')).toBeVisible()
  expect(putUserBodies).toEqual([])

  await expect(dialog.getByRole('link', { name: 'Terms of Service' })).toHaveAttribute(
    'href',
    'https://www.thefittingroom.tech/terms-of-service',
  )
  await expect(dialog.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute(
    'href',
    'https://www.thefittingroom.tech/privacy-policy',
  )

  await dialog.getByPlaceholder('Email').fill('new@example.com')
  await dialog.getByPlaceholder('Password').fill('secret1')
  await dialog.getByPlaceholder('Name').fill('Sam Shopper')
  await dialog.getByRole('radio', { name: 'Male', exact: true }).click()
  await dialog.getByText('I am 18 or older').click()
  await dialog.getByText('I agree to the').click()
  await dialog.getByRole('button', { name: 'Create account' }).click()

  await expect
    .poll(() => putUserBodies)
    .toEqual([{ full_name: 'Sam Shopper', is_gte_18: true, is_tos_accepted: true, gender: 'male' }])

  // The backend syncs the new profile to Firestore; quick view (where the
  // shopper started) carries on with the male demo avatar.
  await writeUserDoc(page, 'signup-new@example.com', { ...TEST_DEMO_USER_PROFILE, gender: 'male' })
  await expect(page.locator('img[src*="image_"]')).toBeVisible()
  await expect(watermark(page)).toBeVisible()
  await expect(page.getByRole('dialog').getByRole('button', MINI_ME)).toBeVisible()
})

// Fills every sign-up field with something valid.
async function fillSignUp(page: Page, email: string) {
  const dialog = page.getByRole('dialog')
  await dialog.getByPlaceholder('Email').fill(email)
  await dialog.getByPlaceholder('Password').fill('secret1')
  await dialog.getByPlaceholder('Name').fill('Sam Shopper')
  await dialog.getByRole('radio', { name: 'Female', exact: true }).click()
  await dialog.getByText('I am 18 or older').click()
  await dialog.getByText('I agree to the').click()
}

test('sign-up rejects a malformed email and a short password', async ({ page }) => {
  let putUsers = 0
  await bootSdk(page, {
    loggedIn: false,
    apiOverrides: {
      putUser: (route) => {
        putUsers += 1
        return route.fulfill({ status: 201, json: {} })
      },
    },
  })
  await page.getByRole('button', { name: /quick view/i }).click()
  await page.getByRole('button', { name: 'Try it now, scan later' }).click()
  const dialog = page.getByRole('dialog')
  await fillSignUp(page, 'not-an-email')
  await dialog.getByPlaceholder('Password').fill('12345')
  await dialog.getByRole('button', { name: 'Create account' }).click()

  await expect(dialog.getByText('Please enter a valid email address.')).toBeVisible()
  await expect(dialog.getByText('Password must be at least 6 characters.')).toBeVisible()
  // The other fields were fine.
  await expect(dialog.getByText('Please enter your name.')).toHaveCount(0)

  // Fixing the email clears its error; the password still holds the form back.
  await dialog.getByPlaceholder('Email').fill('new@example.com')
  await dialog.getByRole('button', { name: 'Create account' }).click()
  await expect(dialog.getByText('Please enter a valid email address.')).toHaveCount(0)
  await expect(dialog.getByText('Password must be at least 6 characters.')).toBeVisible()
  expect(putUsers).toBe(0)
})

test('when the account record fails, submitting again retries only the record', async ({ page }) => {
  const statuses = [500, 201]
  const putUserBodies: unknown[] = []
  await bootSdk(page, {
    loggedIn: false,
    ...quickViewBoot(),
    apiOverrides: {
      ...quickViewBoot().apiOverrides,
      putUser: (route) => {
        putUserBodies.push(route.request().postDataJSON())
        const status = statuses.shift() ?? 201
        return route.fulfill({ status, json: status === 500 ? { error: 'boom' } : {} })
      },
    },
  })
  await page.getByRole('button', { name: /quick view/i }).click()
  await page.getByRole('button', { name: 'Try it now, scan later' }).click()
  const dialog = page.getByRole('dialog')
  await fillSignUp(page, 'retry@example.com')
  await dialog.getByRole('button', { name: 'Create account' }).click()
  await expect(dialog.getByText("Couldn't create your account. Please try again.")).toBeVisible()

  // The Firebase account exists now; signing up to it again would fail with
  // "email already in use", so the retry goes straight to the record.
  await dialog.getByRole('button', { name: 'Create account' }).click()
  await expect.poll(() => putUserBodies.length).toBe(2)
  await expect(dialog.getByText('An account with this email already exists.')).toHaveCount(0)
  await writeUserDoc(page, 'signup-retry@example.com', TEST_DEMO_USER_PROFILE)
  await expect(watermark(page)).toBeVisible()
})

test('signing up with an email that already has an account offers sign in', async ({ page }) => {
  await bootSdk(page, {
    loggedIn: false,
    accounts: [{ uid: 'taken-uid', email: 'taken@example.com', idToken: 'taken-token' }],
  })
  await page.getByRole('button', { name: /quick view/i }).click()
  await page.getByRole('button', { name: 'Try it now, scan later' }).click()

  const dialog = page.getByRole('dialog')
  await dialog.getByPlaceholder('Email').fill('taken@example.com')
  await dialog.getByPlaceholder('Password').fill('secret1')
  await dialog.getByPlaceholder('Name').fill('Sam Shopper')
  await dialog.getByRole('radio', { name: 'Female', exact: true }).click()
  await dialog.getByText('I am 18 or older').click()
  await dialog.getByText('I agree to the').click()
  await dialog.getByRole('button', { name: 'Create account' }).click()

  await expect(dialog.getByText('An account with this email already exists.')).toBeVisible()
  await expect(dialog.getByText('Is it yours?')).toBeVisible()
  await dialog.getByText('Sign in.').click()
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Sign in', exact: true })).toBeVisible()
})

// --- signed in, no avatar of their own -------------------------------------------

test.describe('desktop', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
  })

  test('a demo shopper sees the demo avatar, watermarked, with Create your Mini Me', async ({ page }) => {
    await bootFittingRoom(page, TEST_DEMO_USER_PROFILE)

    // With nothing selected the pane shows the bare avatar: the demo one.
    await expect(page.locator('img[src*="image_0"]')).toHaveAttribute('src', /user-demo-female\/avatar-9\/frames\//)
    await expect(watermark(page)).toBeVisible()

    // The pill opens the get-app content over the fitting room; closing it
    // returns to the fitting room as it was.
    await page.getByRole('button', MINI_ME).click()
    await expect(page.getByRole('img', { name: 'QR Code' })).toBeVisible()
    await page.getByRole('button', { name: 'Close modal' }).click()
    await expect(page.getByRole('img', { name: 'QR Code' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /Test Product/i })).toBeVisible()
  })

  test('a shopper with their own avatar sees neither the watermark nor the pill', async ({ page }) => {
    await bootFittingRoom(page, TEST_USER_PROFILE)

    await expect(page.locator('img[src*="image_0"]')).toHaveAttribute('src', new RegExp(`user-${TEST_UID}/avatar-1/`))
    await expect(watermark(page)).toHaveCount(0)
    await expect(page.getByRole('button', MINI_ME)).toHaveCount(0)
  })

  // A re-scan (PENDING) or a failed re-render (NOT_CREATED) leaves the previous
  // avatar in place, and the backend keeps rendering on it.
  for (const status of ['PENDING', 'NOT_CREATED'] as const) {
    test(`a shopper with frames and status ${status} keeps their own avatar`, async ({ page }) => {
      await bootFittingRoom(page, { ...TEST_USER_PROFILE, avatar_status: status, gender: 'female' })

      await expect(page.locator('img[src*="image_0"]')).toHaveAttribute('src', new RegExp(`user-${TEST_UID}/avatar-1/`))
      await expect(watermark(page)).toHaveCount(0)
      await expect(page.getByRole('button', MINI_ME)).toHaveCount(0)
    })
  }

  // The pane is 560x900 and a frame 2:3, so the picture is 560x840 with 30px
  // bands above and below it: a watermark placed by the box lands in the band.
  test('the watermark sits on the picture, not the letterbox around it', async ({ page }) => {
    await bootFittingRoom(page, TEST_DEMO_USER_PROFILE, portraitFrames)
    await page.getByRole('button', { name: /Test Product/i }).click()
    await expectWatermarkOnPicture(page)
  })

  test('the zoom view is watermarked too, on the part of the picture in view', async ({ page }) => {
    await bootFittingRoom(page, TEST_DEMO_USER_PROFILE, portraitFrames)
    await page.getByRole('button', { name: /Test Product/i }).click()
    await page.getByRole('button', { name: 'Zoom In' }).click()
    // The pane's image and the zoomed one.
    await expect(watermark(page)).toHaveCount(2)
    // The zoomed image is taller than the screen, so its own bottom corner is
    // scrolled out of sight: the watermark follows what is in view.
    await expectWatermarkOnPicture(page, 1)
  })

  test('the card pane has the jump-to-section control', async ({ page }) => {
    // Short enough that the two rails overflow the card pane.
    await page.setViewportSize({ width: 1440, height: 420 })
    await bootFittingRoom(page, TEST_USER_PROFILE)

    const nav = page.getByTestId('section-nav')
    await expect(nav.getByRole('button')).toHaveText('Tops')
    await nav.getByRole('button').click()
    await nav.getByRole('button', { name: 'Bottoms', exact: true }).click()
    // Jumping scrolls the card column, and the control follows.
    await expect(nav.getByRole('button')).toHaveText('Bottoms')
  })

  test('a shopper with no gender chooses a demo avatar first', async ({ page }) => {
    const genderBodies: unknown[] = []
    const vtoPosts = { count: 0 }
    const sizeRecs = { count: 0 }
    const boot = quickViewBoot(vtoPosts, sizeRecs)
    await bootSdk(page, {
      profile: { ...TEST_DEMO_USER_PROFILE, gender: '' },
      ...boot,
      apiOverrides: {
        ...boot.apiOverrides,
        putUserGender: (route) => {
          genderBodies.push(route.request().postDataJSON())
          return route.fulfill({ status: 200, json: {} })
        },
      },
    })
    await page.getByRole('button', { name: /quick view/i }).click()

    const dialog = page.getByRole('dialog')
    await expect(dialog.getByText('Choose your sample Mini Me')).toBeVisible()
    // Nothing is asked of the backend until there is an avatar to ask about
    // (it would answer 409, gender required).
    await page.waitForTimeout(500)
    expect(sizeRecs.count).toBe(0)
    expect(vtoPosts.count).toBe(0)
    await dialog.getByRole('button', { name: 'Male', exact: true }).click()

    await expect.poll(() => genderBodies).toEqual([{ gender: 'male' }])
    await expect(page.locator('img[src*="image_"]')).toBeVisible()
    await expect(watermark(page)).toBeVisible()
    await expect.poll(() => sizeRecs.count).toBeGreaterThan(0)
  })

  test('if saving the gender fails, the prompt says so and stays', async ({ page }) => {
    await bootSdk(page, {
      profile: { ...TEST_DEMO_USER_PROFILE, gender: '' },
      ...quickViewBoot(),
      apiOverrides: {
        ...quickViewBoot().apiOverrides,
        putUserGender: (route) => route.fulfill({ status: 500, json: { error: 'boom' } }),
      },
    })
    await page.getByRole('button', { name: /quick view/i }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByRole('button', { name: 'Female', exact: true }).click()
    await expect(dialog.getByText("Couldn't save your choice. Please try again.")).toBeVisible()
    await expect(dialog.getByText('Choose your sample Mini Me')).toBeVisible()
    await expect(watermark(page)).toHaveCount(0)
  })

  // There is no special handling for the backend's 503 (no demo avatar set up):
  // it is a failed try-on like any other.
  test('a demo try-on the backend refuses shows the try-on error', async ({ page }) => {
    await bootSdk(page, {
      profile: TEST_DEMO_USER_PROFILE,
      ...quickViewBoot(),
      apiOverrides: {
        ...quickViewBoot().apiOverrides,
        vtoComposition: (route) => route.fulfill({ status: 503, json: { error: 'demo avatar not found' } }),
      },
    })
    await page.getByRole('button', { name: /quick view/i }).click()
    await expect(page.getByText("Couldn't load the try-on. Please try again.")).toBeVisible()
  })

  test("when the shopper's own avatar arrives, the demo one is dropped", async ({ page }) => {
    const vtoPosts = { count: 0 }
    const sizeRecs = { count: 0 }
    await bootSdk(page, { profile: TEST_DEMO_USER_PROFILE, ...quickViewBoot(vtoPosts, sizeRecs) })
    await page.getByRole('button', { name: /quick view/i }).click()
    await expect(watermark(page)).toBeVisible()
    await expect(page.getByRole('dialog').getByRole('button', MINI_ME)).toBeVisible()
    await expect.poll(() => vtoPosts.count).toBeGreaterThan(0)
    const postsOnDemo = vtoPosts.count
    const sizeRecsOnDemo = sizeRecs.count
    expect(sizeRecsOnDemo).toBeGreaterThan(0)

    // Their scan finished: the avatar sync writes their own frames.
    await writeUserDoc(page, TEST_UID, TEST_USER_PROFILE)

    // The size recommendation (computed on the demo avatar's measurements)
    // and the try-on are both requested again, for their own avatar, and the
    // demo markings go.
    await expect.poll(() => sizeRecs.count).toBeGreaterThan(sizeRecsOnDemo)
    await expect.poll(() => vtoPosts.count).toBeGreaterThan(postsOnDemo)
    await expect(watermark(page)).toHaveCount(0)
    await expect(page.getByRole('dialog').getByRole('button', MINI_ME)).toHaveCount(0)
    await expect(page.getByRole('dialog').getByText('Quick View Try On')).toBeVisible()
  })
})

test.describe('mobile', () => {
  const { defaultBrowserType: _browser, ...pixel5 } = devices['Pixel 5']
  test.use(pixel5)

  test('a demo shopper gets Create your Mini Me on browse and try-on', async ({ page }) => {
    await bootFittingRoom(page, TEST_DEMO_USER_PROFILE)

    // Browse: beside the section control.
    await expect(page.getByRole('button', MINI_ME)).toBeVisible()
    await expect(page.getByTestId('section-nav')).toBeVisible()

    await page.getByRole('button', { name: /Test Product/i }).click()
    await page.getByRole('button', { name: 'Try it on', exact: true }).click()

    // Try-on: top right, and the frames carry the watermark.
    await expect(page.getByRole('button', MINI_ME)).toBeVisible()
    await expect(watermark(page)).toBeVisible()
  })

  test.describe('with the phone viewport', () => {
    test.beforeEach(async ({ page }) => {
      await phoneViewport(page)
    })

    test('the try-on watermark sits on the picture', async ({ page }) => {
      await bootFittingRoom(page, TEST_DEMO_USER_PROFILE, portraitFrames)
      await page.getByRole('button', { name: /Test Product/i }).click()
      await page.getByRole('button', { name: 'Try it on', exact: true }).click()
      await expectWatermarkOnPicture(page)
    })

    // On a Pixel 5 the collapsed sheet covers the bottom ~26px of the picture:
    // a watermark in the picture's corner would be half under it.
    test('in quick view the watermark stays above the collapsed sheet', async ({ page }) => {
      await bootSdk(page, {
        profile: TEST_DEMO_USER_PROFILE,
        ...quickViewBoot(),
        apiOverrides: { ...quickViewBoot().apiOverrides, frames: portraitFrames },
      })
      await page.getByRole('button', { name: /quick view/i }).click()
      await expectWatermarkOnPicture(page)
    })
  })
})
