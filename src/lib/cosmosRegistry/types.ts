// ---------------------------------------------------------------------------
// cosmos.directory response shapes
// ---------------------------------------------------------------------------
// `chains.cosmos.directory` returns a 200-ish-chain index in one JSON
// payload (~200 kB); `chains.cosmos.directory/<chain_name>` returns rich
// per-chain data (~5-10 kB). We store both lookups in a single zustand
// store, refreshed on vault unlock per the operator brief.
//
// The shapes below mirror what cosmos.directory actually returns rather
// than the upstream `@chain-registry/types` `Chain` interface. The two
// overlap heavily but diverge on `best_apis` (a cosmos.directory-only
// liveness-curated convenience field) and on response wrapping.
// ---------------------------------------------------------------------------

/** Entry in the `GET https://chains.cosmos.directory` index response. */
export interface CosmosDirectoryIndexEntry {
  name: string
  path: string
  chain_name: string
  network_type?: string
  pretty_name?: string
  chain_id: string
  status?: string
  bech32_prefix: string
  slip44?: number
  symbol?: string
  display?: string
  denom?: string
  decimals?: number
  image?: string
  website?: string
}

/** Wrapped response from `GET https://chains.cosmos.directory`. */
export interface CosmosDirectoryIndexResponse {
  repository?: { url: string; branch: string; commit: string; timestamp: number }
  chains: CosmosDirectoryIndexEntry[]
}

/** API endpoint entry — both raw chain-registry `apis.rpc/.rest[]` and
 * cosmos.directory's `best_apis.rpc/.rest[]` use this shape. */
export interface ApiEndpoint {
  address: string
  provider?: string
  archive?: boolean
}

/** Explorer entry — `tx_page` is a URL template with `${txHash}` placeholder. */
export interface Explorer {
  kind: string
  url?: string
  tx_page?: string
  account_page?: string
}

/** Per-chain detail response from `GET https://chains.cosmos.directory/<chain_name>`.
 * Wraps the canonical chain.json shape with cosmos.directory's `best_apis`
 * (liveness-curated) addition. */
export interface CosmosDirectoryChainDetails {
  chain_name: string
  chain_id: string
  pretty_name?: string
  status?: string
  network_type?: string
  bech32_prefix: string
  slip44?: number
  apis?: { rpc?: ApiEndpoint[]; rest?: ApiEndpoint[]; grpc?: ApiEndpoint[] }
  /** cosmos.directory-curated subset of `apis.*` filtered for liveness. */
  best_apis?: { rpc?: ApiEndpoint[]; rest?: ApiEndpoint[] }
  explorers?: Explorer[]
}

/** Wrapped response from `GET https://chains.cosmos.directory/<chain_name>`. */
export interface CosmosDirectoryChainResponse {
  chain: CosmosDirectoryChainDetails
}
