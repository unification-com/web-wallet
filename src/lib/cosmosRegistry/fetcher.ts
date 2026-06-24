import {
  type CosmosDirectoryChainDetails,
  type CosmosDirectoryChainResponse,
  type CosmosDirectoryIndexEntry,
  type CosmosDirectoryIndexResponse,
} from './types'

// ---------------------------------------------------------------------------
// cosmos.directory fetch helpers
// ---------------------------------------------------------------------------
// Two endpoints used by the registry:
//   - `GET https://chains.cosmos.directory` → 200-ish-chain index
//   - `GET https://chains.cosmos.directory/<chain_name>` → per-chain detail
//
// Both return CORS-friendly JSON. We don't follow redirects beyond cosmos.
// directory's own pages — the wrapped responses (`{repository, chains: [...]}`
// and `{chain: {...}}` respectively) are unwrapped here so callers handle
// the leaf data directly.
//
// On HTTP error or network failure, the helpers return `null` rather than
// throwing — the store layer treats `null` as "couldn't refresh; keep prior
// cached value". The wallet degrades gracefully to "no cross-chain
// enrichment" rather than a hard error in the UI.
// ---------------------------------------------------------------------------

const INDEX_URL = 'https://chains.cosmos.directory'

/** Fetch the full chain-registry index. Returns null on any failure. */
export async function fetchChainIndex(): Promise<CosmosDirectoryIndexEntry[] | null> {
  try {
    const res = await fetch(INDEX_URL, {
      headers: { accept: 'application/json' },
    })
    if (!res.ok) return null
    const body = (await res.json()) as CosmosDirectoryIndexResponse
    return body.chains
  } catch {
    return null
  }
}

/**
 * Fetch detailed chain.json data for `chainName` — RPCs (incl. best_apis),
 * explorers, full apis listing. Returns null on any failure (treated by the
 * store as "no rich data available", row degrades to index-only fields).
 */
export async function fetchChainDetails(
  chainName: string,
): Promise<CosmosDirectoryChainDetails | null> {
  try {
    const res = await fetch(`${INDEX_URL}/${chainName}`, {
      headers: { accept: 'application/json' },
    })
    if (!res.ok) return null
    const body = (await res.json()) as CosmosDirectoryChainResponse
    return body.chain
  } catch {
    return null
  }
}
