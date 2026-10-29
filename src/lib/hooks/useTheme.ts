import { useEffect } from 'react'

import { useVaultStore } from '@/lib/vault'

export type ThemeMode = 'system' | 'light' | 'dark'
export type ThemePalette = 'cosmos' | 'mainframe'

/**
 * Reads the user's theme preferences from the vault and applies them to
 * the document by toggling `.dark` and `.theme-mainframe` on <html>.
 *
 * Source of truth:
 *   vault.preferences.themeMode    → ThemeMode (default 'dark')
 *   vault.preferences.themePalette → ThemePalette (default 'cosmos')
 *
 * Until the vault is hydrated (or for the locked-out unlock screen),
 * we keep whatever class was applied by bootstrap.tsx — which sets
 * `.dark` by default so first-run users see Cosmos · Dark.
 *
 * Place a single `<ThemeApplier />` near the root of <App/> so the
 * effect runs once per change.
 */
export function useTheme() {
  const mode    = useVaultStore((s) => (s.vault?.preferences.themeMode    ?? 'dark'))
  const palette = useVaultStore((s) => (s.vault?.preferences.themePalette ?? 'cosmos'))

  useEffect(() => {
    const html = document.documentElement

    const apply = () => {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      const dark = mode === 'dark' || (mode === 'system' && prefersDark)
      html.classList.toggle('dark', dark)
      html.classList.toggle('theme-mainframe', palette === 'mainframe')
    }

    apply()

    // React to OS-level scheme changes when the user is on 'system'.
    if (mode !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [mode, palette])
}

/**
 * Render-prop component form for places that prefer composition over
 * hook usage at the root. `<ThemeApplier />` renders nothing.
 */
export function ThemeApplier() {
  useTheme()
  return null
}
