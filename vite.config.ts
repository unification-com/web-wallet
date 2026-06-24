import path from 'node:path'

import { crx } from '@crxjs/vite-plugin'
import { lingui } from '@lingui/vite-plugin'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { visualizer } from 'rollup-plugin-visualizer'
import { defineConfig } from 'vite'

import manifest from './src/manifest.json' with { type: 'json' }

// The default mode produces the Chrome Extension via @crxjs/vite-plugin.
// `vite build --mode web` produces the Docker-served browser bundle (no MV3, no service worker).
//
// Dev vs. prod outDir split (added 2026-05-19 after a Status-code-3 SW load on dist/ from a
// stale `yarn dev` build): `yarn dev` writes to `dist-dev/` (with localhost HMR loader),
// `yarn build` writes to `dist/` (standalone, no localhost). Load `dist/` as unpacked
// production extension; load `dist-dev/` while `yarn dev` is running.
export default defineConfig(({ command, mode }) => {
  const isWebBundle = mode === 'web'
  const isDev = command === 'serve'

  const input: Record<string, string> = isWebBundle
    ? { web: path.resolve(__dirname, 'web.html') }
    : { standalone: path.resolve(__dirname, 'standalone.html') }

  return {
    plugins: [
      // @vitejs/plugin-react uses Babel — lingui needs `babel-plugin-macros`
      // injected so its `<Trans>` / `t` / `msg` macro imports get transformed
      // at build time into runtime i18n lookups. Plugin order matters: react()
      // runs before lingui() since lingui transforms the compiled JSX.
      react({
        babel: {
          plugins: ['macros'],
        },
      }),
      lingui(),
      tailwindcss(),
      ...(isWebBundle ? [] : [crx({ manifest })]),
      // Set ANALYSE=1 to write dist/bundle-report.html showing the byte
      // breakdown by package. Off by default so normal builds stay fast.
      ...(process.env.ANALYSE
        ? [
            visualizer({
              filename: 'dist/bundle-report.html',
              open: false,
              gzipSize: true,
              brotliSize: true,
            }),
          ]
        : []),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
      // fundjs-react ships its own copies of these shared deps (its own @cosmjs/*,
      // cosmjs-types, and a react ancestry). Without dedupe, Rollup bundles TWO copies —
      // both the "two copies of react" runtime footgun and a duplicated ~1.2 MB of
      // generated proto bindings (cosmjs-types) in the vendor chunk. Dedupe forces a
      // single copy, resolved from web-wallet's own node_modules.
      dedupe: [
        'react',
        'react-dom',
        '@tanstack/react-query',
        'cosmjs-types',
        // fundjs-react has its own ../node_modules/@cosmjs copies (different
        // patch versions or just hoisted independently); without dedupe we
        // bundle TWO copies of @cosmjs/stargate, @cosmjs/proto-signing etc.
        '@cosmjs/amino',
        '@cosmjs/encoding',
        '@cosmjs/math',
        '@cosmjs/proto-signing',
        '@cosmjs/stargate',
        '@cosmjs/tendermint-rpc',
        '@cosmjs/utils',
        // NB: `@interchainjs/math` is NOT in this list — it's not installed in
        // web-wallet's own node_modules, so deduping it forces Rollup to
        // resolve to a missing path and the bundle emits a bare `import` that
        // fails at runtime ("Relative references must start with…"). It's
        // resolved through fundjs's node_modules and bundled into vendor-fundjs.
      ],
    },
    optimizeDeps: {
      // Pre-bundle fundjs-react (a CJS package) so its named exports resolve cleanly
      // through Vite's dep optimiser using web-wallet's node_modules.
      include: ['@unification-com/fundjs-react'],
    },
    build: {
      outDir: isWebBundle ? 'dist-web' : isDev ? 'dist-dev' : 'dist',
      emptyOutDir: true,
      // fundjs-react is a CJS package; its `exports.Foo = …` named exports must be
      // recognised as ESM-style named exports during the Rollup pass so imports like
      // `import { MsgCreateStream } from '…/tx'` resolve. The default `[/node_modules/]`
      // scan covers it now that it's a published node_modules dependency.
      commonjsOptions: {
        include: [/node_modules/],
      },
      // crxjs bundles popup.html (via manifest action.default_popup) automatically.
      // standalone.html is an extension page (not manifest-referenced), so we add it
      // to rollupOptions.input so Vite emits it alongside the popup. Web bundle mode
      // builds web.html as a standalone non-extension page.
      //
      // Manual vendor chunking splits the bundle into stable groups so a typical
      // app-code release only invalidates the small `app` chunk; cosmjs / react /
      // radix vendors stay cached across releases. Also makes the bundle-size
      // composition immediately visible in build output.
      rollupOptions: {
        input,
        output: {
          manualChunks(id: string) {
            // fundjs-react + its interchainjs runtime → their own chunk. Holds the
            // Unification telescope-generated proto bindings for x/stream / x/wrkchain /
            // x/beacon / x/enterprise — kept distinct from cosmjs so its weight is visible
            // and so lazy stream/enterprise tabs can land their bindings in route-specific
            // chunks instead of the eager bundle.
            if (
              id.includes('@unification-com/fundjs-react') ||
              id.includes('@interchainjs')
            ) {
              return 'vendor-fundjs'
            }
            // Only chunk node_modules — app code stays in the main bootstrap
            // chunk so a typical app-code release only invalidates ~15 kB.
            if (!id.includes('node_modules')) return undefined
            // cosmjs + protobuf — the broadcast/query stack. ~169 kB gzipped.
            if (id.includes('@cosmjs') || id.includes('protobufjs') || id.includes('cosmjs-types')) {
              return 'vendor-cosmjs'
            }
            // Pure crypto primitives — bip39, @noble/*, @scure/*, hash-wasm,
            // buffer polyfill. ~222 kB gzipped (dominant since cosmjs delegates
            // to these).
            if (
              id.includes('bip39') ||
              id.includes('@noble/') ||
              id.includes('@scure/') ||
              id.includes('/buffer/') ||
              id.includes('hash-wasm')
            ) {
              return 'vendor-crypto'
            }
            // UI primitives — Radix + lucide + qrcode. ~15 kB gzipped.
            if (
              id.includes('@radix-ui') ||
              id.includes('lucide-react') ||
              id.includes('qrcode.react')
            ) {
              return 'vendor-ui'
            }
            // Everything else (react, react-dom, @tanstack, zod, zustand,
            // react-hook-form, hookform/resolvers, transitive deps). Bundled
            // together to avoid circular-chunk warnings; ~110 kB gzipped.
            return 'vendor-app'
          },
        },
      },
      chunkSizeWarningLimit: 2000,
    },
    server: {
      port: 5173,
      strictPort: true,
    },
  }
})
