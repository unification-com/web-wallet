import { Buffer } from 'buffer'

import { i18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { StrictMode, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'

import { activateLocale } from './i18n'
import { queryClient } from './queryClient'
import '../index.css'

// Install Buffer as a browser-side global for deps that expect Node's Buffer
// (bip39, fundjs-react helpers). cosmjs is already guarded with typeof checks.
;(globalThis as { Buffer?: typeof Buffer }).Buffer ??= Buffer

// Activate the default locale before any React mount. At M1.11 close this is
// synchronous because the source locale ('en') needs no catalogue. Once
// translated locales exist, activateLocale() becomes the async load point.
void activateLocale()

export function mount(children: ReactNode) {
  const root = document.getElementById('root')
  if (!root) throw new Error('#root element not found in document')
  createRoot(root).render(
    <StrictMode>
      <I18nProvider i18n={i18n}>
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </I18nProvider>
    </StrictMode>,
  )
}
