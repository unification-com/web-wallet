![Unification](https://raw.githubusercontent.com/unification-com/mainchain/master/unification_logoblack.png "Unification")

# Unification Mainchain Web wallet

The Unification Mainchain web wallet. Distributed primarily as a Chrome Extension; also buildable as a standalone web bundle.

## Status

**v2 (React + Vite + TypeScript) on the `vaxildan` branch — feature-complete at v1.0.0, pending the Web Store release.** The legacy Vue 2 source (v0.21.0) has been removed now v2 is at feature parity; historic build artefacts remain under `OLD_DIST/` (local-only; gitignored). The Chrome Web Store extension ID (`mkjjflkhdddfjhonakofipfojoepfndk`) is preserved by uploading v2's `.zip` to the existing Web Store listing, so v1 users auto-update.

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

**Requires Node ≥ 22** (active LTS; see `.nvmrc`). If you use `nvm`, `nvm use` in this directory selects the right version automatically.

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

- **Production-mode** (standalone, no dev server needed):
  1. `yarn build` → produces `dist/`
  2. `chrome://extensions` → Developer mode → "Load unpacked" → select `dist/`

- **Dev-mode** (HMR; requires `yarn dev` running):
  1. `yarn dev` → starts Vite dev server, writes `dist-dev/` with HMR loader (localhost URLs)
  2. `chrome://extensions` → "Load unpacked" → select `dist-dev/`
  3. Keep `yarn dev` running; the extension auto-reloads on file changes.

`dist/` and `dist-dev/` are kept separate so a stale dev build can't accidentally be loaded as a production extension (which would fail with `Service worker registration failed. Status code: 3` because the dev SW loader references `localhost:5173`).

## Internationalisation (lingui)

Every user-facing string is extracted into a single catalogue at `src/locales/en/messages.po` via [lingui](https://lingui.dev) v6. The wallet ships with British English as the source locale; additional locales are landed post-M9 by translators.

**Adding a new user-facing string**:

```tsx
import { Trans, useLingui } from '@lingui/react/macro'

function Example() {
  const { t } = useLingui()
  return (
    <>
      <h1><Trans>Welcome</Trans></h1>
      <input placeholder={t`type a phrase`} />
    </>
  )
}
```

Then run `yarn lingui:extract` to update `src/locales/en/messages.po`. Commit the .po change alongside your component change. The CI `yarn lingui:check` gate fails if you forget to extract.

For errors thrown from non-React code (`src/lib/**`), use the `msg` macro from `@lingui/core/macro` + the singleton `i18n._()`:

```ts
import { msg } from '@lingui/core/macro'
import { i18n } from '@/lib/i18n'

throw new Error(i18n._(msg`something went wrong`))
```

**Catalogue conventions**: British English everywhere. Identifier names + commit messages also British (see project `CLAUDE.md`). Third-party API names keep upstream spelling. Don't edit `messages.po` by hand for new entries — always go through `yarn lingui:extract`. Translator edits to `msgstr` lines are fine (that's what the .po is for).

**Compile vs extract**:

- `yarn lingui:extract` reads sources → writes/updates `messages.po`. Run when adding/changing strings.
- `yarn lingui:compile` reads `messages.po` → writes runtime `.mjs` catalogues. Run before production build (or as part of CI). Source-locale `en` doesn't strictly need a compiled catalogue since macros fall through to the source string, but compile anyway so the production code path matches non-en locales.
- `yarn lingui:check` re-extracts and fails if the on-disk `.po` differs from what extraction would produce — the CI gate.

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
└── OLD_DIST/           v0.21.0 build outputs + historic release zips (local only)
```

## License

MIT — see `LICENSE`.
