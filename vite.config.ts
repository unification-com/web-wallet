import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { crx } from '@crxjs/vite-plugin'
import manifest from './src/manifest.json' with { type: 'json' }
import path from 'node:path'

// The default mode produces the Chrome Extension via @crxjs/vite-plugin.
// `vite build --mode web` produces the Docker-served browser bundle (no MV3, no service worker).
export default defineConfig(({ mode }) => {
  const isWebBundle = mode === 'web'

  return {
    plugins: [
      react(),
      tailwindcss(),
      ...(isWebBundle ? [] : [crx({ manifest })]),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    build: {
      outDir: isWebBundle ? 'dist-web' : 'dist',
      emptyOutDir: true,
      rollupOptions: isWebBundle
        ? {
            input: {
              web: path.resolve(__dirname, 'web.html'),
            },
          }
        : undefined,
    },
    server: {
      port: 5173,
      strictPort: true,
    },
  }
})
