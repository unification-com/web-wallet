// ---------------------------------------------------------------------------
// cosmos registry — public surface
// ---------------------------------------------------------------------------
// Data layer: cosmos.directory's JSON index + per-chain detail endpoints,
// cached in chrome.storage. Refreshed on each vault unlock (per operator
// brief 2026-05-27).
//
// Manifest impact: host_permissions for `https://chains.cosmos.directory/*`
// — declared in `src/manifest.json` so Chrome Web Store review sees the
// intent up front.
// ---------------------------------------------------------------------------

export {
  useChainByChainId,
  useChainByChainName,
  useChainDetails,
  useCosmosRegistryHydrated,
} from './hooks'

export { useCosmosRegistryStore } from './store'

export type {
  ApiEndpoint,
  CosmosDirectoryChainDetails,
  CosmosDirectoryIndexEntry,
  Explorer,
} from './types'
