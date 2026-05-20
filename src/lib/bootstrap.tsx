import { Buffer } from 'buffer'

import { QueryClientProvider } from '@tanstack/react-query'
import { StrictMode, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'

import { queryClient } from './queryClient'
import '../index.css'

// Install Buffer as a browser-side global for deps that expect Node's Buffer
// (bip39, fundjs-react helpers). cosmjs is already guarded with typeof checks.
;(globalThis as { Buffer?: typeof Buffer }).Buffer ??= Buffer

export function mount(children: ReactNode) {
  const root = document.getElementById('root')
  if (!root) throw new Error('#root element not found in document')
  createRoot(root).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </StrictMode>,
  )
}
