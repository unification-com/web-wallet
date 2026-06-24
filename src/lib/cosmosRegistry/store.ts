import { create } from 'zustand'

import { fetchChainDetails, fetchChainIndex } from './fetcher'
import {
  type CosmosDirectoryChainDetails,
  type CosmosDirectoryIndexEntry,
} from './types'

// ---------------------------------------------------------------------------
// Cosmos registry store
// ---------------------------------------------------------------------------
// Two layers of cached data:
//   - INDEX (full 228-chain summary, refreshed on each vault unlock per the
//     operator brief; ~200 kB)
//   - DETAILS (per-chain rich data including RPC list + explorers, fetched
//     lazily on first access per chain; ~5-10 kB each)
//
// Both layers persist via `chrome.storage.local` so popup-close + reopen
// doesn't lose the cache. The wallet falls back to localStorage when run
// outside the extension context (standalone HTML tab, web bundle, dev
// server).
//
// State diverges from cache-fill state for clarity:
//   - `loading` is true while a refresh is in flight
//   - `chainsByChainId` / `chainsByChainName` are derived lookup maps
//     populated from the index payload
//   - `detailsByChainName` holds the lazy per-chain rich data
// ---------------------------------------------------------------------------

const STORAGE_INDEX_KEY = 'webwallet:cosmos-registry:index:v1'
const STORAGE_DETAILS_KEY = 'webwallet:cosmos-registry:details:v1'

interface Backend {
  get(key: string): Promise<string | null>
  set(key: string, value: string): Promise<void>
}

const chromeBackend: Backend = {
  async get(key) {
    const result = await chrome.storage.local.get(key)
    return (result[key] as string | undefined) ?? null
  },
  async set(key, value) {
    await chrome.storage.local.set({ [key]: value })
  },
}

const localStorageBackend: Backend = {
  get(key) {
    return Promise.resolve(localStorage.getItem(key))
  },
  set(key, value) {
    localStorage.setItem(key, value)
    return Promise.resolve()
  },
}

function backend(): Backend | null {
  if (typeof chrome !== 'undefined' && chrome.storage?.local !== undefined) {
    return chromeBackend
  }
  if (typeof localStorage !== 'undefined') return localStorageBackend
  return null
}

interface State {
  /** The raw index list — populated from cosmos.directory on refresh or
   * loaded from chrome.storage on hydrate. */
  index: CosmosDirectoryIndexEntry[]
  /** Derived map: chain_id → index entry. Rebuilt whenever `index` changes. */
  chainsByChainId: Map<string, CosmosDirectoryIndexEntry>
  /** Derived map: chain_name → index entry. Same source. */
  chainsByChainName: Map<string, CosmosDirectoryIndexEntry>
  /** Per-chain detailed data, lazy-fetched on first access. */
  detailsByChainName: Record<string, CosmosDirectoryChainDetails>
  /** Whether the initial chrome.storage hydrate has run. UI components can
   * gate "no chain registry data yet" messaging on this. */
  hydrated: boolean
  /** True while an index refresh is in flight. */
  loading: boolean
  /** Last error from a failed index refresh. Per-chain detail-fetch errors
   * don't surface here — they leave the slot empty so the caller can retry
   * lazily. */
  error: Error | null

  /** Load both index + details cache from chrome.storage. Called once at
   * app boot to populate the in-memory state without a network round-trip. */
  hydrate: () => Promise<void>

  /** Fetch a fresh index from cosmos.directory and persist it. Called on
   * each vault unlock. Idempotent and safe to call concurrently — if a
   * refresh is already in flight, the second call no-ops. */
  refresh: () => Promise<void>

  /** Ensure detailed data for `chainName` is in memory. Fetches if missing
   * (and persists); otherwise no-op. Returns the entry. */
  ensureDetails: (chainName: string) => Promise<CosmosDirectoryChainDetails | null>
}

function buildLookups(entries: CosmosDirectoryIndexEntry[]): {
  byChainId: Map<string, CosmosDirectoryIndexEntry>
  byChainName: Map<string, CosmosDirectoryIndexEntry>
} {
  const byChainId = new Map<string, CosmosDirectoryIndexEntry>()
  const byChainName = new Map<string, CosmosDirectoryIndexEntry>()
  for (const entry of entries) {
    if (entry.chain_id) byChainId.set(entry.chain_id, entry)
    if (entry.chain_name) byChainName.set(entry.chain_name, entry)
  }
  return { byChainId, byChainName }
}

export const useCosmosRegistryStore = create<State>((set, get) => ({
  index: [],
  chainsByChainId: new Map(),
  chainsByChainName: new Map(),
  detailsByChainName: {},
  hydrated: false,
  loading: false,
  error: null,

  async hydrate() {
    const back = backend()
    if (!back) {
      set({ hydrated: true })
      return
    }
    try {
      const [indexRaw, detailsRaw] = await Promise.all([
        back.get(STORAGE_INDEX_KEY),
        back.get(STORAGE_DETAILS_KEY),
      ])
      const index = indexRaw
        ? (JSON.parse(indexRaw) as CosmosDirectoryIndexEntry[])
        : []
      const detailsByChainName = detailsRaw
        ? (JSON.parse(detailsRaw) as Record<string, CosmosDirectoryChainDetails>)
        : {}
      const lookups = buildLookups(index)
      set({
        index,
        chainsByChainId: lookups.byChainId,
        chainsByChainName: lookups.byChainName,
        detailsByChainName,
        hydrated: true,
      })
    } catch (err) {
      // Corrupt cache — log + reset rather than crash the wallet.
      console.warn('[cosmosRegistry] hydrate failed', err)
      set({ hydrated: true })
    }
  },

  async refresh() {
    if (get().loading) return
    set({ loading: true, error: null })
    const fresh = await fetchChainIndex()
    if (!fresh) {
      // Network/HTTP failure — keep existing cached data, mark error.
      set({ loading: false, error: new Error('failed to fetch cosmos.directory chain index') })
      return
    }
    const lookups = buildLookups(fresh)
    set({
      index: fresh,
      chainsByChainId: lookups.byChainId,
      chainsByChainName: lookups.byChainName,
      loading: false,
      error: null,
    })
    const back = backend()
    if (back) {
      try {
        await back.set(STORAGE_INDEX_KEY, JSON.stringify(fresh))
      } catch (err) {
        // chrome.storage write failed (quota?) — in-memory state still
        // works for the current session, log for diagnostics.
        console.warn('[cosmosRegistry] persist index failed', err)
      }
    }
  },

  async ensureDetails(chainName) {
    const cached = get().detailsByChainName[chainName]
    if (cached) return cached
    const fresh = await fetchChainDetails(chainName)
    if (!fresh) return null
    set((s) => ({
      detailsByChainName: { ...s.detailsByChainName, [chainName]: fresh },
    }))
    const back = backend()
    if (back) {
      try {
        await back.set(
          STORAGE_DETAILS_KEY,
          JSON.stringify(get().detailsByChainName),
        )
      } catch (err) {
        console.warn('[cosmosRegistry] persist details failed', err)
      }
    }
    return fresh
  },
}))
