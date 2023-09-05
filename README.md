# The Fitting Room - Shop UI

Modal UI for The Fitting Room. Provides UI hooks to integrate into the parent UI.

## Installation

```bash
npm i @thefittingroom/shop-ui
```

or

```bash
yarn @thefittingroom/shop-ui
```

## Usage

```typescript
import { initFittingRoom } from '@thefittingroom/shop-ui'

// Your brandId: Number
const shopId: number = 9001

// UI Hooks
const hooks: TfrHooks = {
  onLoading: () => {},
  onLoadingComplete: () => {},
  onVtoReady: (frames: string[]) => {},
  onError: (error: string) => {},
  onLogin: () => {},
  onLogout: () => {},
}

// the div id to contain the modal elements
const modalDivId: string = 'tfr-modal'

// initFittingRoom is an async function and must be awaited
const tfr = await initFittingRoom(shopId, modalDivId, hooks)

// on page nav to new product
// * Required for VTO
tfr.setSku(sku)

// on user login to brand site
// * Required for VTO
// e.g. uuid, email address, username, internal database Id
tft.setBrandUserId(brandUserId)

// close the modal
tfr.close()
```

Several low level methods are exposed via `tfr.shop`

See [@thefittingroom/sdk](https://github.com/TheFittingRoom/shop-sdk/tree/main)
