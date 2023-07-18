# The Fitting Room - Shop SDK

## Installation

```bash
# install nodejs and npm
# clone the repository
git clone git@github.com:TheFittingRoom/shop-sdk.git

# install dependencies
npm install

# Create .env file for testing on development firebase
FIREBASE_API_KEY=AIzaSyDfjBWzpmzb-mhGN8VSURxzLg6nkzmKUD8
FIREBASE_AUTH_DOMAIN=fittingroom-dev-5d248.firebaseapp.com
FIREBASE_PROJECT_ID=fittingroom-dev-5d248
FIREBASE_STORAGE_BUCKET=fittingroom-dev-5d248.appspot.com
FIREBASE_MESSAGING_SENDER_ID=2298664147
FIREBASE_APP_ID=1:2298664147:web:340bda75cd5d25f3997026
FIREBASE_MEASUREMENT_ID=G-B7GDQ1Y9LL
# point these to localhost or development
API_ENDPOINT = https://tfr.dev.thefittingroom.xyz/v1
LANGUAGE_URL=https://assets.dev.thefittingroom.xyz/shop-sdk/4200127/languages
ASSETS_URL=https://assets.dev.thefittingroom.xyz/shop-sdk/assets

# build everytime changes are detected
npm run dev:rollup
# run a live server on localhost:3030 and disable cors
npx live-server --host=localhost --port=3030 --cors
```

The sdk gets transpiled from typescript a javascript ESM module located at `dist/esm/main(.min).js`

You can develop locally and reference it in your html like this:
`import {InitFittingRoom, comps, InitLocale} from "http://localhost:3030/dist/cjs/main.js"`

## Merges on main branch

When a pull request gets merged into main, a development build gets published to S3.
You can access the development builds by using a commit sha on main like this:

`import {InitFittingRoom, comps, InitLocale} from "https://assets.dev.thefittingroom.xyz/shop-sdk/<COMMIT_SHA>/main.js"`

## Overriding library functions

The sdk works out of the box with modals and does not require any overriding.
All methods on the `tfr` object are overridable.
View the [FittingRoom](https://github.com/TheFittingRoom/shop-sdk/blob/96d59558bdbec6cc1e899cac297838a4810de5d4/src/types/index.ts#L63) interface to see all of the overridable function signatures.
The main implementation can be found in `init.ts`

```javascript
// use the language code in the get url (ex. ?lang=en)
InitLocale()

// define a modal div in the html to attach the fitting room to
let tfr = InitFittingRoom(1, 'tfr-tryon-modal')

// add an optional sign out button
let signout = document.getElementById('signout')
signout.addEventListener('click', () => {
  // pass an empty sku to the onSignout since its not being used in a modal
  // call the onSignout function wrapper to return a promise
  // wait for the promise
  // shows signed out modal by default
  tfr
    .onSignout('')()
    .then(() => {
      // do something after signing out of the fitting room
    })
})

// call TryOn with a colorway_size_asset sku
document.getElementById('tryon').addEventListener('click', (e) => {
  tfr.TryOn('5003-007-08')
})
```

## Localization

You can call `SetLocale` to change the language of the sdk without using url searchParams.

```javascript
SetLocale('en')
  .then(() => {
    // do something after setting the locale
  })
  .catch((err) => {
    // handle error
  })
```

Warnings will be generated in the console for any missing locale definitions.
