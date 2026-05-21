import path from 'node:path'

import { lingui } from '@lingui/vite-plugin'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  // Same lingui plugin pipeline as the production build (vite.config.ts) so
  // macros in src/ get transformed during test runs. Without this, lib code
  // that throws `i18n._(msg\`…\`)` errors hits the macro runtime guard and
  // emits "The macro you imported from @lingui/core/macro is being executed
  // outside the context of compilation" — tests see that string instead of
  // the real error.
  plugins: [
    react({ babel: { plugins: ['macros'] } }),
    lingui(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    // Only scan v2 source. OLD_VUE/ contains v1's Vue 2 spec files that don't
    // run under vitest and aren't relevant to the v2 build.
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules/**', 'OLD_VUE/**', 'OLD_DIST/**', 'dist/**', 'dist-dev/**', 'dist-web/**'],
    environment: 'node',
    globals: false,
    setupFiles: ['./vitest.setup.ts'],
  },
})
