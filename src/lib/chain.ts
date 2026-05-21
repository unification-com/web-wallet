import { StargateClient } from '@cosmjs/stargate'
import { msg } from '@lingui/core/macro'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

import { i18n } from './i18n'
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
  /**
   * Optional explorer base URL for tx-hash deep-links. When set, the tx-
   * history view + Send success-line render the hash as a clickable link.
   * The final URL is built by appending the upper-case hash, so the base
   * must include any required path segment (e.g. `…/tx/`).
   */
  txExplorerBase?: string
}

const BUILT_IN: Record<string, ChainEndpoint> = {
  mainnet: {
    id: 'mainnet',
    label: 'MainNet',
    rpc: 'https://rpc1.unification.io:443',
    rest: 'https://rest.unification.io',
    source: 'built-in',
    txExplorerBase: 'https://explorer.unification.io/u/tx/',
  },
  testnet: {
    id: 'testnet',
    label: 'TestNet',
    rpc: 'https://rpc-testnet.unification.io:443',
    rest: 'https://rest-testnet.unification.io',
    source: 'built-in',
    txExplorerBase: 'https://explorer.unification.io/u-testnet/tx/',
  },
  devnet: {
    id: 'devnet',
    label: 'DevNet',
    rpc: 'http://localhost:26657',
    rest: 'http://localhost:1317',
    source: 'built-in',
    // No public explorer for the local DevNet container.
  },
}

/**
 * Build the explorer-link URL for a given tx hash on the active endpoint.
 * Returns null when the endpoint has no `txExplorerBase` configured — UI
 * callers should render the hash as plain monospace text in that case.
 */
export function txExplorerUrl(endpoint: ChainEndpoint, hash: string): string | null {
  if (!endpoint.txExplorerBase) return null
  return `${endpoint.txExplorerBase}${hash.toUpperCase()}`
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
    ...(c.txExplorerBase ? { txExplorerBase: c.txExplorerBase } : {}),
  }
}

// ---------------------------------------------------------------------------
// Active endpoint — reads from vault prefs; mainnet fallback
// ---------------------------------------------------------------------------

/**
 * The endpoint the user is currently connected to. Reads from
 * `vault.preferences.activeEndpointId`. Falls back to mainnet when the vault
 * is locked / not yet hydrated / points at a missing custom endpoint.
 *
 * Selector identity hazard (fixed 2026-05-21): a previous one-shot selector
 * called `customToChainEndpoint(custom)` inline, which returned a fresh
 * object every render → Zustand's `Object.is` saw "state changed" → React
 * re-rendered → loop → React error #185 ("Maximum update depth exceeded").
 * Now we select stable primitive references and derive the ChainEndpoint in
 * a downstream `useMemo`.
 */
export function useActiveEndpoint(): ChainEndpoint {
  const activeId = useVaultStore((s) => s.vault?.preferences.activeEndpointId ?? 'mainnet')
  const customEndpoints = useVaultStore((s) => s.vault?.customEndpoints)

  return useMemo(() => {
    if ((BUILT_IN_ENDPOINT_IDS as readonly string[]).includes(activeId)) {
      return BUILT_IN[activeId] ?? BUILT_IN.mainnet
    }
    const custom = customEndpoints?.find((e) => e.id === activeId)
    return custom ? customToChainEndpoint(custom) : BUILT_IN.mainnet
  }, [activeId, customEndpoints])
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
    // 8 s aligns with useBalance — both surfaces refresh roughly per block.
    refetchInterval: 8_000,
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
  let client: StargateClient
  try {
    client = await StargateClient.connect(rpc)
  } catch {
    throw new Error(i18n._(msg`couldn't reach the RPC endpoint — please check the URL`))
  }
  try {
    const chainId = await client.getChainId()
    const height = await client.getHeight()
    return { chainId, height }
  } finally {
    client.disconnect()
  }
}

/**
 * REST-side counterpart of `pingNodeInfo`. Hits the standard SDK endpoints:
 *   - `/cosmos/base/tendermint/v1beta1/node_info` → `default_node_info.network`
 *   - `/cosmos/base/tendermint/v1beta1/blocks/latest` → `block.header.height`
 *
 * Used by the Add-custom-endpoint form to cross-check that the REST URL is
 * on the same chain as the RPC URL (and to surface the chain ID inline).
 */
export async function pingRestNodeInfo(rest: string): Promise<PingResult> {
  const base = rest.replace(/\/$/, '')
  let nodeInfoRes: Response
  try {
    nodeInfoRes = await fetch(`${base}/cosmos/base/tendermint/v1beta1/node_info`)
  } catch {
    throw new Error(i18n._(msg`couldn't reach the REST endpoint — please check the URL`))
  }
  if (!nodeInfoRes.ok) {
    throw new Error(
      i18n._(
        msg`REST node_info request failed: ${nodeInfoRes.status} ${nodeInfoRes.statusText}. Check the URL is a Cosmos REST gateway (not RPC).`,
      ),
    )
  }
  let nodeInfo: { default_node_info?: { network?: string } }
  try {
    nodeInfo = (await nodeInfoRes.json()) as { default_node_info?: { network?: string } }
  } catch (err) {
    const inner = err instanceof Error ? err.message : String(err)
    throw new Error(
      i18n._(msg`REST endpoint returned non-JSON — check the URL is a Cosmos REST gateway. (${inner})`),
    )
  }
  const chainId = nodeInfo.default_node_info?.network
  if (!chainId) {
    throw new Error(
      i18n._(
        msg`REST response missing default_node_info.network — endpoint reachable but not a Cosmos SDK REST gateway.`,
      ),
    )
  }
  // Best-effort height — failure here doesn't invalidate the chain ID check.
  let height = 0
  try {
    const blockRes = await fetch(`${base}/cosmos/base/tendermint/v1beta1/blocks/latest`)
    if (blockRes.ok) {
      const blockJson = (await blockRes.json()) as { block?: { header?: { height?: string } } }
      const h = blockJson.block?.header?.height
      if (h) height = Number.parseInt(h, 10)
    }
  } catch {
    // ignore — height is informational
  }
  return { chainId, height }
}
