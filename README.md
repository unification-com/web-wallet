![Unification](https://raw.githubusercontent.com/unification-com/mainchain/master/unification_logoblack.png "Unification")

# Unification Mainchain Web wallet

The Unification Mainchain web wallet. Distributed primarily as a Chrome Extension; also buildable as a standalone web bundle.

## Status

**Mid-rebuild — v2 (React + Vite + TypeScript) on the `vaxildan` branch.** The Vue 2 source from v0.21.0 is parked under `OLD_VUE/` for the duration of the rebuild and will be removed once v2 reaches feature parity. Built artefacts from v0.21.0 are parked under `OLD_DIST/` (local-only; gitignored). The Chrome Web Store extension ID (`mkjjflkhdddfjhonakofipfojoepfndk`) is preserved by uploading v2's `.zip` to the existing Web Store listing, so v1 users auto-update.

Planning docs live under `../project_docs/planning/web-wallet/`.

## Stack

| Layer | Choice |
|---|---|
| Framework | React 18 |
| Build | Vite 6 + `@crxjs/vite-plugin` (MV3) |
| Language | TypeScript 5.6 |
| State (server) | TanStack Query 5 |
| State (client) | Zustand 5 (planned, M1) |
| UI | Tailwind v4 + shadcn/ui (Radix primitives) |
| Chain SDK | `@unification-com/fundjs ^0.2.0` (added at M1 once Stage 10 publishes) + `@cosmjs/*` |
| Hardware wallet | `@ledgerhq/hw-app-cosmos` + WebHID (M8) |
| Testing | Vitest + Playwright |

## Development

```bash
yarn install
yarn dev       # Vite dev server with HMR; extension auto-reloads via crxjs
yarn build     # production extension build → dist/
yarn build:web # standalone web bundle → dist-web/
yarn lint
yarn test
```

### Linked `fundjs-react` (local sibling repo)

While `@unification-com/fundjs-react@^0.2.0` is unpublished (pending vaxildan Stage 10), web-wallet consumes the local sibling at `../fundjs/packages/fundjs-react/dist` via yarn's `link:` protocol. Iterate on fundjs source as needed; rebuild its dist to surface changes here:

```bash
# from web-wallet/
cd ../fundjs/packages/fundjs-react && yarn build && cd -
# the symlink picks up the new dist/ automatically; no yarn install needed in web-wallet
```

If you change `web-wallet/package.json` and re-run `yarn install`, the link is preserved as long as the `link:../fundjs/packages/fundjs-react/dist` entry stays. Once Stage 10 publishes the npm release, swap the entry for `"@unification-com/fundjs-react": "^0.2.0"`.

To load the extension in Chrome:

1. `yarn build`
2. Open `chrome://extensions`
3. Enable Developer mode
4. Click "Load unpacked" → select `dist/`

## Directory layout

```
.
├── popup.html          Vite entry — extension popup (≤ 500×600 UI)
├── standalone.html     Vite entry — full-tab extension page
├── web.html            Vite entry — non-extension browser bundle
├── public/             Static assets (icons, _locales, favicon)
├── src/
│   ├── manifest.json   MV3 manifest (v1 identity preserved + storage permission)
│   ├── popup/          Popup entry + components
│   ├── standalone/     Standalone entry + components
│   ├── web/            Web entry
│   ├── background/     MV3 service worker
│   ├── components/     Shared UI
│   ├── lib/            Shared infrastructure (chain client, query, vault, utils)
│   └── App.tsx         Shared root component (per-surface variants)
├── OLD_VUE/            v0.21.0 Vue 2 source, parked for the rebuild duration
└── OLD_DIST/           v0.21.0 build outputs + historic release zips (local only)
```

## License

MIT — see `LICENSE`.
