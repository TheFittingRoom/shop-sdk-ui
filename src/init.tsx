import { App } from '@components/app'
import { initShop } from '@thefittingroom/sdk'
import { render } from 'preact'
import type { ThemeCssVariables } from './hooks/use-theme-css-vars'
import { createHandle, type FittingRoomHandle, stateManager } from './state'

export type TfrCssVariables = ThemeCssVariables

export type TrfConfig = {
  shopId: string | number
  modalDivId: string
  sizeRecMainDivId: string
  vtoMainDivId?: string
  cssVariables?: TfrCssVariables
  env?: string
}

export type FittingRoomConfig = {
  shopId: string | number
  containers: {
    modalId: string
    sizeRecId: string
    vtoId?: string
  }
  theme?: ThemeCssVariables
  env?: string
}

/**
 * Mount a FittingRoomApp with the new hooks-based architecture
 * @param config - Configuration for the FittingRoomApp
 *
 * @returns Handle for imperative control
 */
export const mountFittingRoomApp = async (config: FittingRoomConfig): Promise<FittingRoomHandle> => {
  const env = config.env || 'dev'
  const tfrShop = initShop(Number(config.shopId), env)

  await tfrShop.onInit()

  stateManager.initialize(tfrShop, { theme: config.theme })

  const sizeRecContainer = document.getElementById(config.containers.sizeRecId)
  if (!sizeRecContainer) {
    throw new Error(`SizeRec container not found: ${config.containers.sizeRecId}`)
  }

  render(<App tfrShop={tfrShop} containers={config.containers} theme={config.theme} />, sizeRecContainer)

  // Wait for React components to mount and set up event listeners
  await new Promise<void>((resolve) => {
    const handleReady = () => {
      window.removeEventListener('fittingroom:ready', handleReady)
      resolve()
    }

    window.addEventListener('fittingroom:ready', handleReady)

    // Fallback timeout in case the ready event doesn't fire
    setTimeout(() => {
      window.removeEventListener('fittingroom:ready', handleReady)
      resolve()
    }, 2000)
  })

  return createHandle()
}

/**
 * @deprecated Use mountFittingRoomApp(config: FittingRoomConfig) instead
 *
 * Initialize a FittingRoom instance with v3 object configuration
 * @param config - Configuration object containing all FittingRoom parameters
 * @returns Promise<FittingRoomHandle>
 */
export function initFittingRoom(config: TrfConfig): Promise<FittingRoomHandle>

/**
 * @deprecated Use mountFittingRoomApp(config: FittingRoomConfig) instead
 */
export function initFittingRoom(
  shopId: string | number,
  modalDivId: string,
  sizeRecMainDivId: string,
  vtoMainDivId?: string,
  hooks?: any,
  cssVariables?: TfrCssVariables,
  env?: string,
): Promise<FittingRoomHandle>

export async function initFittingRoom(
  shopIdOrConfig: string | number | TrfConfig,
  modalDivId?: string,
  sizeRecMainDivId?: string,
  vtoMainDivId?: string,
  _hooks: any = {},
  cssVariables: TfrCssVariables = {},
  env: string = 'dev',
): Promise<FittingRoomHandle> {
  let config: TrfConfig

  if (typeof shopIdOrConfig === 'object' && shopIdOrConfig !== null) {
    config = shopIdOrConfig

    if (!config.shopId || (typeof config.shopId !== 'string' && typeof config.shopId !== 'number')) {
      throw new Error('initFittingRoom: shopId is required and must be a string or number')
    }
    if (!config.modalDivId || typeof config.modalDivId !== 'string') {
      throw new Error('initFittingRoom: modalDivId is required and must be a string')
    }
    if (!config.sizeRecMainDivId || typeof config.sizeRecMainDivId !== 'string') {
      throw new Error('initFittingRoom: sizeRecMainDivId is required and must be a string')
    }
    if (config.vtoMainDivId !== undefined && typeof config.vtoMainDivId !== 'string') {
      throw new Error('initFittingRoom: vtoMainDivId must be a string if provided')
    }
    if (config.env !== undefined && typeof config.env !== 'string') {
      throw new Error('initFittingRoom: env must be a string if provided')
    }
  } else {
    if (
      shopIdOrConfig === undefined ||
      shopIdOrConfig === null ||
      (typeof shopIdOrConfig !== 'string' && typeof shopIdOrConfig !== 'number')
    ) {
      throw new Error('initFittingRoom: shopId is required and must be a string or number')
    }
    if (!modalDivId || typeof modalDivId !== 'string') {
      throw new Error('initFittingRoom: modalDivId is required and must be a string')
    }
    if (!sizeRecMainDivId || typeof sizeRecMainDivId !== 'string') {
      throw new Error('initFittingRoom: sizeRecMainDivId is required and must be a string')
    }
    if (vtoMainDivId !== undefined && typeof vtoMainDivId !== 'string') {
      throw new Error('initFittingRoom: vtoMainDivId must be a string if provided')
    }
    if (env !== undefined && typeof env !== 'string') {
      throw new Error('initFittingRoom: env must be a string if provided')
    }

    config = {
      shopId: shopIdOrConfig,
      modalDivId,
      sizeRecMainDivId,
      vtoMainDivId: vtoMainDivId || '',
      cssVariables,
      env,
    }
  }

  const finalConfig = {
    cssVariables: {},
    env: 'dev',
    vtoMainDivId: '',
    ...config,
  }

  const newConfig: FittingRoomConfig = {
    shopId: finalConfig.shopId,
    containers: {
      modalId: finalConfig.modalDivId,
      sizeRecId: finalConfig.sizeRecMainDivId,
      vtoId: finalConfig.vtoMainDivId || undefined,
    },
    theme: finalConfig.cssVariables,
    env: finalConfig.env,
  }

  const handle = await mountFittingRoomApp(newConfig)

  return handle as any
}
