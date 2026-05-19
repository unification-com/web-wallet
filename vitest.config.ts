import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
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
  },
})
