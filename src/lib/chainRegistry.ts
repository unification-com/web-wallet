import { useQuery } from '@tanstack/react-query'

import { FALLBACK_GAS_PRICES } from './gasEstimate'

// ---------------------------------------------------------------------------
// Module note — chain-registry runtime fetch
// ---------------------------------------------------------------------------
// Pulls `unification/chain.json` from the cosmos/chain-registry repo at
// runtime. The relevant slice today is `fees.fee_tokens[0]` (gas-price
// tiers) — the gas-accordion's Slow/Normal/Fast presets read from here.
//
// Strategy: hardcoded fallback constants live in `gasEstimate.ts`
// (FALLBACK_GAS_PRICES) and act as `initialData` for the query. That
// means consumers get useful values IMMEDIATELY on first paint without
// waiting for the fetch. When the live fetch resolves, the values update
// to whatever upstream chain-registry says. If the fetch fails (offline,
// GitHub rate-limited, registry repo moved), the fallback constants
// remain — wallet stays usable.
//
// No vendored JSON file. The constants in `gasEstimate.ts` are the
// source of truth for the offline path; bump them when upstream changes
// significantly enough to matter for offline-default correctness.
//
// Future-milestone phases (M12 chain-registry integration) layer
// additional consumers on top of this fetch — explorers list, RPC
// fallback, multi-chain expansion. See chain-registry-investigation.md.
// ---------------------------------------------------------------------------

const CHAIN_REGISTRY_URL =
  'https://raw.githubusercontent.com/cosmos/chain-registry/master/unification/chain.json'

/** Slice of the chain.json schema we currently consume. */
interface ChainRegistryEntry {
  fees?: {
    fee_tokens?: readonly {
      denom?: string
      fixed_min_gas_price?: number
      low_gas_price?: number
      average_gas_price?: number
      high_gas_price?: number
    }[]
  }
}

export interface GasPrices {
  fixedMin: number
  low: number
  average: number
  high: number
}

/**
 * Pure helper — extract gas-price tiers from a chain-registry chain.json
 * payload. Returns the fallback constants for any field the registry
 * doesn't populate, so partial data degrades gracefully field-by-field
 * rather than all-or-nothing.
 */
export function gasPricesFromChainJson(entry: ChainRegistryEntry): GasPrices {
  const nund = entry.fees?.fee_tokens?.find((t) => t.denom === 'nund')
  return {
    fixedMin: nund?.fixed_min_gas_price ?? FALLBACK_GAS_PRICES.fixedMin,
    low: nund?.low_gas_price ?? FALLBACK_GAS_PRICES.low,
    average: nund?.average_gas_price ?? FALLBACK_GAS_PRICES.average,
    high: nund?.high_gas_price ?? FALLBACK_GAS_PRICES.high,
  }
}

/**
 * Live chain-registry gas prices. Returns `FALLBACK_GAS_PRICES`
 * immediately via `initialData`, then refreshes from the registry in the
 * background (24h stale window). Network failure keeps the fallback —
 * the hook never enters an error state from the consumer's POV; live
 * data is a best-effort upgrade over the offline-safe defaults.
 */
export function useChainGasPrices(): GasPrices {
  const query = useQuery({
    queryKey: ['chain-registry', 'unification', 'gas-prices'],
    queryFn: async (): Promise<GasPrices> => {
      const res = await fetch(CHAIN_REGISTRY_URL)
      if (!res.ok) throw new Error(`chain-registry fetch failed: ${res.status.toString()}`)
      const json = (await res.json()) as ChainRegistryEntry
      return gasPricesFromChainJson(json)
    },
    initialData: { ...FALLBACK_GAS_PRICES },
    staleTime: 24 * 60 * 60 * 1000, // 24h — gas tiers rarely change
    // On fetch error, silently keep the fallback. The wallet remains
    // fully functional with stale-but-sensible defaults; users only
    // notice if upstream changed dramatically AND they're offline AND
    // they care about the preset values.
    retry: false,
  })
  return query.data
}
