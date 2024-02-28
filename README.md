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
// These are used to hook into the lifecycle methods within the shop UI
const hooks: TfrHooks = {
  onLoading: () => {},
  onLoadingComplete: () => {},
  onError: (error: string) => {},
  onLogin: () => {},
  onLogout: () => {},
}

// the div id to contain the modal elements
const modalDivId: string = 'tfr-modal'

// The div id to contain the size recommendation UI
const sizeRecDivId: string = 'tfr-size-rec'

// initFittingRoom is an async function and must be awaited
const tfr = await initFittingRoom(shopId, modalDivId, sizeRecDivId, hooks, 'prod')

// on page nav to new product
tfr.setSku(sku)

// on user login to brand site
// e.g. uuid, email address, username, internal database Id
tfr.setBrandUserId(brandUserId)
```

Several low level methods are exposed via `tfr.shop`

See [@thefittingroom/sdk](https://github.com/TheFittingRoom/shop-sdk/tree/main)
