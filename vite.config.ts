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

  const input: Record<string, string> = isWebBundle
    ? { web: path.resolve(__dirname, 'web.html') }
    : { standalone: path.resolve(__dirname, 'standalone.html') }

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
      // Linked deps (fundjs-react via `link:`) point out-of-tree, so their imports of
      // `@tanstack/react-query` / `react` would otherwise resolve from the linked path's
      // ancestry instead of from web-wallet's own node_modules. Dedupe forces resolution
      // through this project's installed copy, preventing both "module not found" build
      // errors and the "two copies of react" runtime footgun.
      dedupe: ['react', 'react-dom', '@tanstack/react-query'],
    },
    optimizeDeps: {
      // Pre-bundle the linked fundjs-react so its imports get resolved through Vite's
      // bundler using web-wallet's node_modules. Standard fix for `link:` / npm-link setups.
      include: ['@unification-com/fundjs-react'],
    },
    build: {
      outDir: isWebBundle ? 'dist-web' : 'dist',
      emptyOutDir: true,
      // crxjs bundles popup.html (via manifest action.default_popup) automatically.
      // standalone.html is an extension page (not manifest-referenced), so we add it
      // to rollupOptions.input so Vite emits it alongside the popup. Web bundle mode
      // builds web.html as a standalone non-extension page.
      rollupOptions: { input },
      // popup chunk currently lands around 7 MB because the fundjs-react bundle
      // entry pulls in every Msg/query codec. M1+ will switch to targeted sub-path
      // imports (e.g. @unification-com/fundjs-react/mainchain/stream/v1/tx.registry),
      // shrinking the popup bundle by an order of magnitude. Until then, raise the
      // warning ceiling to avoid noisy CI output.
      chunkSizeWarningLimit: 8000,
    },
    server: {
      port: 5173,
      strictPort: true,
    },
  }
})
