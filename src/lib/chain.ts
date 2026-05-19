import { StargateClient } from '@cosmjs/stargate'
import { useQuery } from '@tanstack/react-query'

import { useVaultStore } from './vault'
import { BUILT_IN_ENDPOINT_IDS, type CustomEndpoint } from './vault/types'

// ---------------------------------------------------------------------------
// Endpoint model — unified view across built-in + vault-stored custom endpoints
// ---------------------------------------------------------------------------

export interface ChainEndpoint {
  id: string
  label: string
  rpc: string
  rest: string
  source: 'built-in' | 'custom'
}

const BUILT_IN: Record<string, ChainEndpoint> = {
  mainnet: {
    id: 'mainnet',
    label: 'MainNet',
    rpc: 'https://rpc1.unification.io:443',
    rest: 'https://rest.unification.io',
    source: 'built-in',
  },
  testnet: {
    id: 'testnet',
    label: 'TestNet',
    rpc: 'https://rpc-testnet.unification.io:443',
    rest: 'https://rest-testnet.unification.io',
    source: 'built-in',
  },
  devnet: {
    id: 'devnet',
    label: 'DevNet',
    rpc: 'http://localhost:26657',
    rest: 'http://localhost:1317',
    source: 'built-in',
  },
}

/** Look up a built-in endpoint by id. Returns null for unknown ids. */
export function getBuiltInEndpoint(id: string): ChainEndpoint | null {
  return BUILT_IN[id] ?? null
}

/** Enumerate all built-in endpoints. Used by the settings UI. */
export function listBuiltInEndpoints(): ChainEndpoint[] {
  return Object.values(BUILT_IN)
}

/** Convert a vault-stored CustomEndpoint to the unified ChainEndpoint shape. */
export function customToChainEndpoint(c: CustomEndpoint): ChainEndpoint {
  return {
    id: c.id,
    label: c.label,
    rpc: c.rpc,
    rest: c.rest ?? '',
    source: 'custom',
  }
}

// ---------------------------------------------------------------------------
// Active endpoint — reads from vault prefs; mainnet fallback
// ---------------------------------------------------------------------------

/**
 * The endpoint the user is currently connected to. Reads from
 * `vault.preferences.activeEndpointId`. Falls back to mainnet when the vault
 * is locked / not yet hydrated / points at a missing custom endpoint.
 */
export function useActiveEndpoint(): ChainEndpoint {
  return useVaultStore((s) => {
    const id = s.vault?.preferences.activeEndpointId ?? 'mainnet'
    if ((BUILT_IN_ENDPOINT_IDS as readonly string[]).includes(id)) {
      // Safe: id is one of the built-in ids, so BUILT_IN has it.
      return BUILT_IN[id] ?? BUILT_IN.mainnet
    }
    const custom = s.vault?.customEndpoints.find((e) => e.id === id)
    return custom ? customToChainEndpoint(custom) : BUILT_IN.mainnet
  })
}

// ---------------------------------------------------------------------------
// Chain info query (chain ID + height + RPC URL) for the active endpoint
// ---------------------------------------------------------------------------

export interface ChainInfo {
  chainId: string
  height: number
  rpc: string
}

async function fetchChainInfo(endpoint: ChainEndpoint): Promise<ChainInfo> {
  const client = await StargateClient.connect(endpoint.rpc)
  try {
    const chainId = await client.getChainId()
    const height = await client.getHeight()
    return { chainId, height, rpc: endpoint.rpc }
  } finally {
    client.disconnect()
  }
}

export function useChainInfo() {
  const endpoint = useActiveEndpoint()
  return useQuery({
    queryKey: ['chain-info', endpoint.id, endpoint.rpc],
    queryFn: () => fetchChainInfo(endpoint),
    refetchInterval: 12_000,
  })
}

// ---------------------------------------------------------------------------
// URL validation — pure; used by the settings UI before submitting a custom add
// ---------------------------------------------------------------------------

export interface UrlValidationResult {
  ok: boolean
  reason?: string
}

/**
 * Validate a candidate RPC / REST URL. HTTPS is always accepted; HTTP is only
 * accepted for localhost addresses (DevNet scenario) — protects against
 * mixed-content errors when the web bundle is served over HTTPS.
 *
 * Pure function; no network calls. Use `pingNodeInfo` for the real on-chain
 * sanity check.
 */
export function validateEndpointUrl(url: string): UrlValidationResult {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return { ok: false, reason: 'not a valid URL' }
  }
  if (parsed.protocol === 'https:') return { ok: true }
  if (parsed.protocol === 'http:') {
    const host = parsed.hostname
    const isLocal = host === 'localhost' || host === '127.0.0.1' || host === '[::1]'
    return isLocal
      ? { ok: true }
      : { ok: false, reason: 'HTTP allowed only for localhost; use HTTPS for remote endpoints' }
  }
  return { ok: false, reason: `unsupported protocol: ${parsed.protocol}` }
}

// ---------------------------------------------------------------------------
// pingNodeInfo — async sanity check before saving a custom endpoint
// ---------------------------------------------------------------------------

export interface PingResult {
  chainId: string
  height: number
}

/**
 * Sanity-check a candidate RPC by fetching basic chain info. Returns the
 * reported chain ID + current height so the settings UI can echo them back
 * to the user for confirmation before saving.
 *
 * Throws if the URL is unreachable / not an RPC endpoint / cosmjs fails to
 * connect. The settings UI should surface the error message verbatim.
 */
export async function pingNodeInfo(rpc: string): Promise<PingResult> {
  const client = await StargateClient.connect(rpc)
  try {
    const chainId = await client.getChainId()
    const height = await client.getHeight()
    return { chainId, height }
  } finally {
    client.disconnect()
  }
}
