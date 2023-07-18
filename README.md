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
  onAvatarReady: (frames: string[]) => {},
  onError: () => {},
  onLogin: () => {},
  onLogout: () => {},
}

// the div id to contain the modal elements
const modalDivId: string = 'tfr-modal'

const tfr = initFittingRoom(shopId, modalDivId, hooks)

// on page nav to new product
tfr.setSku(sku)

// close the modal
tfr.close()
```

Several low level methods are exposed via `tfr.shop`

See [@thefittingroom/sdk](https://github.com/TheFittingRoom/shop-sdk/tree/main)
