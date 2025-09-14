import { AppProvider, AuthProvider, ModalProvider, SizeRecProvider, VtoProvider } from '@contexts/index'
import { QueryClientProvider } from '@contexts/query-client-context'
import { TfrShopContext } from '@contexts/tfr-shop-context'
import { type ThemeCssVariables, useThemeCssVars } from '@hooks/use-theme-css-vars'
import type { TfrShop } from '@thefittingroom/sdk'
import { createPortal } from 'preact/compat'
import { ModalPortal } from './modal-portal'
import { SizeRec } from './organisms/size-rec'
import { VtoPortal } from './vto-portal'

interface AppProps {
  tfrShop: TfrShop
  containers: {
    modalId: string
    sizeRecId: string
    vtoId?: string
  }
  theme?: ThemeCssVariables
}

const AppContent = ({ containers }: { containers: AppProps['containers'] }) => {
  return (
    <>
      <SizeRec />
      {createPortal(<ModalPortal containerId={containers.modalId} />, document.getElementById(containers.modalId))}
      {createPortal(<VtoPortal />, document.getElementById(containers.vtoId))}
    </>
  )
}

export const App = (props: AppProps) => {
  const { tfrShop, theme, containers } = props

  useThemeCssVars(theme)

  return (
    <QueryClientProvider value={{ initialized: true }}>
      <TfrShopContext.Provider value={tfrShop}>
        <AppProvider value={{ theme }}>
          <AuthProvider>
            <ModalProvider>
              <SizeRecProvider>
                <VtoProvider>
                  <AppContent containers={containers} />
                </VtoProvider>
              </SizeRecProvider>
            </ModalProvider>
          </AuthProvider>
        </AppProvider>
      </TfrShopContext.Provider>
    </QueryClientProvider>
  )
}
