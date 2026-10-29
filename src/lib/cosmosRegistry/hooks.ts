import { useEffect } from 'react'

import { useCosmosRegistryStore } from './store'
import { type CosmosDirectoryChainDetails, type CosmosDirectoryIndexEntry } from './types'

// ---------------------------------------------------------------------------
// Component-facing hooks for the cosmos registry
// ---------------------------------------------------------------------------

/**
 * Synchronous lookup of an index entry by chain_id (e.g. `"gravity-bridge-3"`).
 * Returns the entry or `null` when the chain isn't in the cached index.
 *
 * Re-renders only when THIS chain's entry changes — selectors use the
 * `chainsByChainId` Map reference which only mutates on index refresh.
 */
export function useChainByChainId(chainId: string | null | undefined): CosmosDirectoryIndexEntry | null {
  return useCosmosRegistryStore((s) => {
    if (!chainId) return null
    return s.chainsByChainId.get(chainId) ?? null
  })
}

/**
 * Synchronous lookup of an index entry by chain_name (e.g. `"gravitybridge"`).
 * Mirror of `useChainByChainId` for callers that hold the registry's
 * chain_name rather than the on-chain chain_id.
 */
export function useChainByChainName(chainName: string | null | undefined): CosmosDirectoryIndexEntry | null {
  return useCosmosRegistryStore((s) => {
    if (!chainName) return null
    return s.chainsByChainName.get(chainName) ?? null
  })
}

/**
 * Get per-chain rich data (RPC list, explorers) — async first-access fetch
 * with chrome.storage backing. Returns `null` while loading or if the chain
 * isn't in the registry.
 *
 * The store's `ensureDetails(chainName)` triggers the fetch on first call
 * and caches the result; subsequent calls return the cached value. We hook
 * into the effect lifecycle so React re-renders when the data lands.
 */
export function useChainDetails(
  chainName: string | null | undefined,
): CosmosDirectoryChainDetails | null {
  const details = useCosmosRegistryStore((s) =>
    chainName ? (s.detailsByChainName[chainName] ?? null) : null,
  )
  const ensureDetails = useCosmosRegistryStore((s) => s.ensureDetails)
  useEffect(() => {
    if (chainName && !details) {
      void ensureDetails(chainName)
    }
  }, [chainName, details, ensureDetails])
  return details
}

/** Whether the initial chrome.storage hydrate has completed. */
export function useCosmosRegistryHydrated(): boolean {
  return useCosmosRegistryStore((s) => s.hydrated)
}
