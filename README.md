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

// CSS Variable

export type TfrCssVariables = {
  // Colors
  brandColor?: string
  black?: string
  red?: string
  white?: string
  muted?: string
  dark?: string
  grey?: string
  lightGrey?: string

  // Main div stlyes
  mainBorderColor?: string
  mainBorderRadius?: string
  mainBorderWidth?: string
  mainBgColor?: string
  mainWidth?: string
  mainVPadding?: string
  mainHPadding?: string

  // Typography
  // All others will inherit fron mainFont if not set
  mainFont?: string
  titleFont?: string
  subtitleFont?: string
  rowFont?: string
  ctaFont?: string

  // Size Selector
  sizeSelectorTextColor?: string
  sizeSelectorFontSize?: string
  sizeSelectorFontWeight?: string
  sizeSelectorBgColor?: string
  sizeSelectorBgColorHover?: string
  sizeSelectorBgColorActive?: string
  sizeSelectorButtonHeight?: string
  sizeSelectorButtonActiveHeight?: string
  sizeSelectorButtonBorderColor?: string
  sizeSelectorButtonBorderWidth?: string
  sizeSelectorButtonRadius?: string
  sizeSelectorButtonShadow?: string
}

// UI Hooks
// These are used to hook into the lifecycle methods within the shop UI
const hooks: TfrHooks = {
  onLoading: () => {},
  onLoadingComplete: () => {},
  onError: (error: string) => {},
  onLogin: () => {},
  onLogout: () => {},
}

const cssVariables = {}

// the div id to contain the modal elements
const modalDivId: string = 'tfr-modal'

// The div id to contain the size recommendation UI
const sizeRecDivId: string = 'tfr-size-rec'

// initFittingRoom is an async function and must be awaited
const tfr = await initFittingRoom(shopId, modalDivId, sizeRecDivId, hooks, cssVariables, 'prod')

// on page nav to new product
tfr.setSku(sku)

// on user login to brand site or after initFittingRoom
// e.g. uuid, email address, username, internal database Id
tfr.setBrandUserId(brandUserId)
```

### CSS variable defaults

```css
:root {
  /* Colors */
  --tfr-brand-color: #209da7;
  --tfr-black: #000000;
  --tfr-red: #ff0000;
  --tfr-white: #ffffff;
  --tfr-muted: #a7a7a7;

  --tfr-dark: #121212;
  --tfr-grey: #878787;
  --tfr-light-grey: #dbdcdc;
  --tfr-dark-grey: #3f3f3f;

  /* Main */
  --tfr-main-border-color: rgba(18, 18, 18, 0.55);
  --tfr-main-border-radius: 0;
  --tfr-main-border-width: 1px;
  --tfr-main-bg-color: inherit;

  /* Spacing */
  --tfr-main-width: 440px;
  --tfr-main-v-padding: 14px;
  --tfr-main-h-padding: 20px;

  /* Typography */
  --tfr-main-font: inherit;
  --tfr-title-font: var(--tfr-main-font);
  --tfr-subtitle-font: var(--tfr-main-font);
  --tfr-row-font: var(--tfr-main-font);
  --tfr-cta-font: var(--tfr-main-font);

  /* Size Selector */
  --tfr-size-selector-text-color: var(--tfr-white);
  --tfr-size-selector-font-size: 14px;
  --tfr-size-selector-font-weight: 400;
  --tfr-size-selector-border-color: transparent;
  --tfr-size-selector-border-width: 0;
  --tfr-size-selector-bg-color: var(--tfr-grey);
  --tfr-size-selector-bg-color-hover: var(--tfr-dark-grey);
  --tfr-size-selector-bg-color-active: var(--tfr-dark);
  --tfr-size-selector-button-height: 35px;
  --tfr-size-selector-button-active-height: 45px;
  --tfr-size-selector-button-active-border-color: transparent;
  --tfr-size-selector-button-active-border-width: 0;
  --tfr-size-selector-button-radius: 8px;
  --tfr-size-selector-button-shadow: 0 4px 4px 0 rgba(0, 0, 0, 0.3);
}
```

Several low level methods are exposed via `tfr.shop`

See [@thefittingroom/sdk](https://github.com/TheFittingRoom/shop-sdk/tree/main)
