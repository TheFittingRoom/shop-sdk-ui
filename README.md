# The Fitting Room - Shop UI

Modal UI for The Fitting Room. Provides UI hooks to integrate into the parent UI.

## Installation

```bash
npm i @thefittingroom/shop-ui
```

or

```bash
npm @thefittingroom/shop-ui
```

## Usage

````typescript
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
const sizeRecMainDivId: string = 'tfr-size-rec'

// The div id to contain the virtual try-on UI (optional)
const vtoMainDivId: string = 'tfr-vto'

## Initialization Options

The Fitting Room SDK supports two initialization patterns for backward compatibility:

### v4 Object Configuration (Recommended)

```typescript
// Minimal configuration
const tfr = await initFittingRoom({
  shopId: 'your-shop-id',
  modalDivId: 'tfr-modal',
  sizeRecMainDivId: 'tfr-size-rec'
})

// Complete configuration with all options
const tfr = await initFittingRoom({
  shopId: 'your-shop-id',
  modalDivId: 'tfr-modal',
  sizeRecMainDivId: 'tfr-size-rec',
  vtoMainDivId: 'tfr-vto', // optional
  hooks: {
    onLogin: () => console.log('User logged in'),
    onLogout: () => console.log('User logged out'),
    onLoading: () => console.log('Loading...'),
    onLoadingComplete: () => console.log('Loading complete'),
    onError: (error: string) => console.error('Error:', error)
  },
  cssVariables: {
    brandColor: '#007bff',
    mainBorderRadius: '8px'
  },
  env: 'prod'
})
````

### v3 Positional Arguments (Legacy Support)

```typescript
// v3 positional arguments - corrected parameter order
const tfr = await initFittingRoom(
  shopId, // string | number
  modalDivId, // string
  sizeRecMainDivId, // string
  vtoMainDivId, // string (optional)
  hooks, // TfrHooks (optional)
  cssVariables, // TfrCssVariables (optional)
  'prod', // env (optional)
)
```

### TypeScript Usage

```typescript
import { initFittingRoom, TrfConfig, TfrHooks, TfrCssVariables } from '@thefittingroom/shop-ui'

// TypeScript with v4 object config
const config: TrfConfig = {
  shopId: process.env.SHOP_ID!,
  modalDivId: 'tfr-modal',
  sizeRecMainDivId: 'tfr-size-rec'
}
const tfr = await initFittingRoom(config)

// TypeScript with hooks
const hooks: TfrHooks = {
  onLogin: () => updateUserState(true),
  onLogout: () => updateUserState(false),
  onLoading: () => showLoadingSpinner(),
  onLoadingComplete: () => hideLoadingSpinner(),
  onError: (error: string) => showErrorMessage(error)
}

const cssVariables: TfrCssVariables = {
  brandColor: '#007bff',
  mainBorderRadius: '12px',
  mainWidth: '480px'
}

const tfr = await initFittingRoom({
  shopId: 'your-shop-id',
  modalDivId: 'tfr-modal',
  sizeRecMainDivId: 'tfr-size-rec',
  vtoMainDivId: 'tfr-vto',
  hooks,
  cssVariables,
  env: 'prod'
})
```

**Note:** The object configuration (v4) is recommended for new implementations as it provides better readability and TypeScript support.

### Guaranteed Stable Selectors

The following DOM elements and their IDs/classes are guaranteed to remain stable:

#### SizeRec Component Selectors

| Selector                              | Purpose                             | Notes                                   |
| ------------------------------------- | ----------------------------------- | --------------------------------------- |
| `#tfr-size-recommendations`           | Main size recommendations container | Root container for all size rec content |
| `#tfr-size-recommendations-container` | Content container                   | Hidden during loading state             |
| `#tfr-size-rec-loading`               | Loading spinner container           | Visible during loading state            |
| `#tfr-size-rec-title-toggle`          | Collapse/expand toggle              | Always present                          |
| `#tfr-size-rec-title`                 | Recommended size title              | Visible when logged in with data        |
| `#tfr-size-rec-size`                  | Size display area                   | Shows recommended size                  |
| `#tfr-login-to-view`                  | Login CTA                           | Visible when logged out                 |
| `#tfr-size-rec-select-container`      | Size selector container             | Contains all size selection UI          |
| `#tfr-size-how-it-fits`               | "How it fits" label                 | Instructions for size selection         |
| `#tfr-size-rec-select`                | Size buttons container              | Contains clickable size buttons         |
| `#tfr-size-rec-subtitle`              | Fit info subtitle                   | "How it fits" with info icon            |
| `#tfr-info-icon`                      | Information icon                    | Triggers fit info modal                 |
| `#tfr-size-rec-table`                 | Fit results table                   | Shows garment fit data                  |
| `#tfr-try-on-button`                  | Virtual try-on button               | Launches VTO experience                 |
| `#tfr-size-rec-action`                | Action buttons container            | Login/logout actions                    |
| `#tfr-size-rec-action-login`          | Sign up/login button                | Visible when logged out                 |
| `#tfr-size-rec-action-logout`         | Logout button                       | Visible when logged in                  |
| `#tfr-size-recommendation-error`      | Error message container             | Shows recommendation errors             |
| `#tfr-logged-out-overlay-container`   | Overlay container                   | Blurred preview for logged-out users    |
| `#tfr-logged-out-overlay`             | Overlay message                     | Explains need to login                  |

#### Modal System Selectors

| Selector                       | Purpose                 | Notes                           |
| ------------------------------ | ----------------------- | ------------------------------- |
| `#tfr-modal-background`        | Modal backdrop          | Click target for backdrop close |
| `#tfr-close-container`         | Close button container  | Modal close button area         |
| `.tfr-modal`                   | Modal wrapper class     | Primary modal styling           |
| `.tfr-modal-content`           | Modal content area      | Main content container          |
| `.tfr-modal-content-container` | Content wrapper         | Styled content wrapper          |
| `.tfr-modal-content-flex`      | Flex container          | Centers modal content           |
| `.tfr-close`                   | Close button styling    | Close button appearance         |
| `.tfr-close-container`         | Close container styling | Close button positioning        |

#### VTO System Selectors

| Selector              | Purpose                | Notes                     |
| --------------------- | ---------------------- | ------------------------- |
| `#tfr-tryon-image`    | Virtual try-on image   | Main VTO image display    |
| `#tfr-slider`         | Size comparison slider | Controls VTO image frames |
| `.tfr-slider-wrapper` | Slider container       | Wraps VTO controls        |

#### Critical CSS Classes

| Class                                      | Purpose                | Notes                                  |
| ------------------------------------------ | ---------------------- | -------------------------------------- |
| `.tfr-size-rec-select-button`              | Size selection buttons | Individual size buttons                |
| `.tfr-size-rec-select-button.active`       | Active size button     | Currently selected size                |
| `.tfr-size-rec-select-button.tfr-disabled` | Disabled size button   | Non-interactive preview                |
| `.tfr-size-rec-table-row`                  | Fit table row          | Individual fit measurement row         |
| `.tfr-size-rec-table-cell-left`            | Garment location cell  | Location name (e.g., "Waist")          |
| `.tfr-size-rec-table-cell-right`           | Fit description cell   | Fit description (e.g., "Perfect Fit")  |
| `.tfr-size-rec-table-cell-right.perfect`   | Perfect fit indicator  | Highlights optimal fit                 |
| `.tfr-logged-out`                          | Logged out state       | Content visible when not authenticated |
| `.tfr-logged-in`                           | Logged in state        | Content visible when authenticated     |
| `.tfr-toggle-open`                         | Expanded state         | Content visible when not collapsed     |
| `.tfr-toggle-closed`                       | Collapsed state        | Content visible when collapsed         |
| `.tfr-try-on-button.loading`               | Loading try-on button  | Button in loading state                |
| `.hide`                                    | Hidden element         | Utility class for hiding elements      |

#### Data Attributes

| Attribute           | Purpose             | Usage                             |
| ------------------- | ------------------- | --------------------------------- |
| `data-index`        | Size button index   | Identifies position in size array |
| `data-size-id`      | Size identifier     | Unique size ID for API calls      |
| `data-key`          | Element key         | Reconciliation key                |
| `data-tfr="hidden"` | SDK hidden elements | Internal state management         |

### DOM Contract Guarantees

1. **Selector Stability**: All documented selectors will remain stable across SDK versions
2. **Attribute Consistency**: Data attributes will maintain their format and purpose
3. **Class Naming**: CSS classes follow the `tfr-` prefix convention
4. **ID Uniqueness**: All IDs are prefixed with `tfr-` to avoid conflicts
5. **State Classes**: State-based classes (`.active`, `.loading`, `.hide`) are preserved

### Integration Guidelines

- **Safe Selectors**: Use only documented selectors for external integrations
- **Event Delegation**: Attach event listeners to stable parent containers
- **CSS Targeting**: Target documented classes and IDs for custom styling
- **State Observation**: Monitor class changes on documented elements for state tracking
- **Accessibility**: All interactive elements include appropriate ARIA attributes

## Usage Methods

```typescript
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

## Migration Guide

The Fitting Room SDK v4 introduces an enhanced initialization pattern while maintaining full backward compatibility with v3. No breaking changes exist - both patterns work identically.

### Initialization Pattern Comparison

| Aspect             | v3 Positional Arguments      | v4 Object Configuration     |
| ------------------ | ---------------------------- | --------------------------- |
| **Syntax**         | Positional parameters        | Named object properties     |
| **Type Safety**    | Limited TypeScript support   | Full TypeScript integration |
| **Readability**    | Parameter order matters      | Self-documenting properties |
| **Flexibility**    | Fixed parameter sequence     | Optional properties         |
| **Maintenance**    | Prone to parameter confusion | Clear property naming       |
| **Default Values** | Must specify all parameters  | Smart defaults applied      |

### v3 to v4 Migration Examples

#### Basic Migration

```typescript
// v3 - Positional arguments
const tfr = await initFittingRoom(
  'your-shop-id',     // shopId
  'tfr-modal',        // modalDivId
  'tfr-size-rec'      // sizeRecMainDivId
)

// v4 - Object configuration (recommended)
const tfr = await initFittingRoom({
  shopId: 'your-shop-id',
  modalDivId: 'tfr-modal',
  sizeRecMainDivId: 'tfr-size-rec'
})
```

#### Full Configuration Migration

```typescript
// v3 - All parameters
const hooks = {
  onLogin: () => console.log('Logged in'),
  onLogout: () => console.log('Logged out'),
  onLoading: () => showSpinner(),
  onLoadingComplete: () => hideSpinner(),
  onError: (error) => showError(error)
}

const cssVariables = {
  brandColor: '#007bff',
  mainBorderRadius: '12px'
}

// v3 - Fixed parameter order (easy to get wrong)
const tfr = await initFittingRoom(
  'your-shop-id',     // shopId
  'tfr-modal',        // modalDivId
  'tfr-size-rec',     // sizeRecMainDivId
  'tfr-vto',          // vtoMainDivId
  hooks,              // hooks
  cssVariables,       // cssVariables
  'prod'              // env
)

// v4 - Named properties (self-documenting)
const tfr = await initFittingRoom({
  shopId: 'your-shop-id',
  modalDivId: 'tfr-modal',
  sizeRecMainDivId: 'tfr-size-rec',
  vtoMainDivId: 'tfr-vto',
  hooks,
  cssVariables,
  env: 'prod'
})
```

#### TypeScript Benefits

```typescript
// v4 provides full IntelliSense and type checking
import { TfrCssVariables, TfrHooks, TrfConfig } from '@thefittingroom/shop-ui'

// Type-safe configuration
const config: TrfConfig = {
  shopId: process.env.SHOP_ID!, // TypeScript ensures this exists
  modalDivId: 'tfr-modal',
  sizeRecMainDivId: 'tfr-size-rec',
  // IntelliSense shows all available options
  hooks: {
    onLogin: () => updateUserState(true),
    onLogout: () => updateUserState(false),
  },
}

const tfr = await initFittingRoom(config)
```

### Migration Strategy Recommendations

1. **New Projects**: Always use v4 object configuration
2. **Existing Projects**:
   - v3 continues to work without changes
   - Migrate to v4 gradually for better maintainability
   - No rush - both patterns are fully supported
3. **Team Projects**: v4 provides better code review experience
4. **TypeScript Projects**: v4 provides superior type safety and IntelliSense

### No Breaking Changes Guarantee

The v4 enhancement is **purely additive**:

- All v3 code continues to work unchanged
- No deprecation warnings or console messages
- Same runtime behavior for both patterns
- Identical initialization result object
- Full backward compatibility maintained indefinitely

## Manual Verification Checklist

Use this checklist to verify your Fitting Room SDK integration is working correctly:

### 1. Initialization Verification

- [ ] **v3 Pattern**: `initFittingRoom(shopId, modalDivId, sizeRecDivId)` returns TFR instance
- [ ] **v4 Pattern**: `initFittingRoom({ shopId, modalDivId, sizeRecMainDivId })` returns identical TFR instance
- [ ] **Container Elements**: All specified div IDs exist in DOM before initialization
- [ ] **Console Errors**: No initialization errors in browser console
- [ ] **TypeScript**: No compilation errors (if using TypeScript)

### 2. Authentication State Testing

- [ ] **Logged Out State**:
  - Size recommendations show "Login to view" message
  - Login CTA is clickable and opens sign-in modal
  - Size buttons are disabled (preview mode)
  - Fit table shows blurred overlay
- [ ] **Login Flow**:
  - Sign-in modal opens with email/password fields
  - Successful login closes modal and updates UI
  - "Forgot Password" and "Scan Code" navigation works
- [ ] **Logged In State**:
  - Recommended size displays prominently
  - Size selector buttons are interactive
  - Fit table shows actual measurements without overlay
  - Try-on button is enabled
- [ ] **Logout Flow**:
  - Logout button visible when authenticated
  - Logout returns UI to logged-out state
  - No residual user data visible

### 3. Size Recommendations Functionality

- [ ] **Data Loading**:
  - Loading spinner shows during recommendation fetch
  - Recommendations display after loading completes
  - Error states handled gracefully
- [ ] **Size Selection**:
  - Size buttons highlight active selection
  - Clicking different sizes updates fit table
  - Recommended size is pre-selected
  - Size selection persists during session
- [ ] **Fit Information**:
  - Fit table shows garment-specific measurements
  - "Perfect Fit" indicators highlight optimal areas
  - Info icon opens detailed fit modal
  - Garment locations match product type

### 4. Modal System Verification

- [ ] **Modal Opening**:
  - Modals center properly on screen
  - Background overlay blocks interaction
  - Focus management works correctly
- [ ] **Modal Navigation**:
  - Sign-in → Forgot Password navigation
  - Forgot Password → Sign-in back navigation
  - Sign-in → Scan Code navigation
  - All modal transitions are smooth
- [ ] **Modal Closing**:
  - Click backdrop to close (if enabled)
  - Press Escape key to close (if enabled)
  - Click X button to close
  - Body scroll restored after close

### 5. Virtual Try-On (VTO) Testing

- [ ] **Container Handling**:
  - VTO works when container div is present
  - Graceful fallback when VTO container missing
  - No JavaScript errors if VTO div not found
- [ ] **Try-On Flow**:
  - Try-On button shows loading state during fetch
  - VTO image displays after successful generation
  - Slider controls allow frame navigation
  - Size comparison works across different sizes
- [ ] **Performance**:
  - Recommended size displays immediately
  - Neighboring sizes preload in background
  - Smooth transitions between VTO frames

### 6. CSS Variables Integration

- [ ] **Default Styling**: SDK displays correctly without custom CSS
- [ ] **Brand Customization**: CSS variables properly override defaults
- [ ] **Responsive Design**: UI adapts to different screen sizes
- [ ] **Theme Integration**: Colors and fonts match site design

### 7. Error Handling Scenarios

- [ ] **Network Failures**: Graceful handling of API timeouts
- [ ] **Invalid Data**: Proper error messages for bad responses
- [ ] **Missing Elements**: Console warnings for missing DOM containers
- [ ] **Authentication Errors**: Clear feedback for login failures

### 8. Performance Verification

- [ ] **Bundle Size**: Production build generates optimized bundles
- [ ] **Memory Usage**: No memory leaks during modal open/close cycles
- [ ] **Network Requests**: Appropriate caching and request deduplication

### 9. Build System Verification

- [ ] **Production Build**: `npm run build:prod` completes without errors
- [ ] **Development Build**: `npm run build:dev` works for debugging
- [ ] **TypeScript**: All types resolve correctly
- [ ] **CSS Processing**: Styles compile and apply correctly

### 10. Cross-Browser Compatibility

- [ ] **Chrome/Edge**: Full functionality works
- [ ] **Firefox**: All features operational
- [ ] **Safari**: VTO and modals work correctly
- [ ] **Mobile Browsers**: Responsive design functions properly

### Verification Commands

```bash
# Build verification
npm run build:prod

# Development server (if using)
npm run serve

# Check for TypeScript errors
npx tsc --noEmit
```

### Expected Success Indicators

✅ **Initialization**: Both v3 and v4 patterns return identical TFR instances
✅ **State Management**: Smooth transitions between logged-in/logged-out states
✅ **DOM Contract**: All documented selectors present and stable
✅ **Performance**: Fast loading and responsive interactions
✅ **Error Handling**: Graceful degradation when services unavailable
✅ **Customization**: CSS variables properly applied throughout UI
✅ **Accessibility**: Proper keyboard navigation and screen reader support

## Low-Level SDK Access

Several low level methods are exposed via `tfr.shop`

See [@thefittingroom/sdk](https://github.com/TheFittingRoom/shop-sdk/tree/main)
