import { type EncodeObject, type OfflineDirectSigner } from '@cosmjs/proto-signing'
import { SigningStargateClient, type StdFee } from '@cosmjs/stargate'

import { type ChainEndpoint } from './chain'

// ---------------------------------------------------------------------------
// Module note
// ---------------------------------------------------------------------------
// cosmjs's `SigningStargateClient.simulate()` runs a dry-run sign + send
// against the chain, returning the gas units actually consumed. The chain
// rejects with a regular cosmjs error if the Tx is malformed; otherwise
// the result is a tight integer that we apply a safety margin to.
//
// Unification's `minimum-gas-prices` config on a typical node is
// `25.0nund` (per the testnet faucet readme + operator command-line
// examples). We treat that as the floor; users can override via the
// advanced fee accordion in the TxModal. There's no on-chain query for
// this — it's per-node `app.toml`, so a sensible default + user override
// is the only path.
// ---------------------------------------------------------------------------

/**
 * Default `minimum-gas-prices` floor on Unification, in nund per gas unit.
 * Used as the always-available fallback when the chain-registry runtime
 * fetch hasn't resolved (offline / first paint / GitHub unreachable).
 * Matches `unification/chain.json:fees.fee_tokens[0].fixed_min_gas_price`
 * — bump when upstream changes if you care about offline correctness.
 */
export const DEFAULT_MIN_GAS_PRICE_NUND = 25

/**
 * Fallback gas-price tiers (nund per gas unit). Same source-of-truth +
 * upgrade story as `DEFAULT_MIN_GAS_PRICE_NUND` — these are the values
 * shown when the chain-registry fetch hasn't resolved yet. Live values
 * via {@link useChainGasPrices} (in `chainRegistry.ts`).
 */
export const FALLBACK_GAS_PRICES = {
  fixedMin: 25,
  low: 100,
  average: 200,
  high: 300,
} as const

export type GasPriceTier = 'low' | 'average' | 'high'

/**
 * Safety margin applied to the simulated gas figure when building the
 * recommended gas budget. 1.4 = 40% headroom — the same headroom that
 * went into bumping `DEFAULT_STAKING_FEE.gas` after the redelegate
 * out-of-gas operator report (250000 → 350000 = +40%).
 */
export const GAS_SAFETY_MULTIPLIER = 1.4

/**
 * Build a `StdFee` from a gas amount + a gas price in nund per unit.
 * The fee amount is rounded up so we never under-pay when the chain
 * multiplies gas × price.
 */
export function buildFee(gas: number, gasPriceNund: number): StdFee {
  const amount = Math.ceil(gas * gasPriceNund)
  return {
    amount: [{ denom: 'nund', amount: amount.toString() }],
    gas: gas.toString(),
  }
}

/**
 * Pure helper — connects via cosmjs, runs `simulate`, disconnects.
 * Returns the simulated gas (an integer). Throws on simulate failure
 * (chain rejected the dry-run). The hook below wraps this for React +
 * caching.
 */
export async function simulateGas(params: {
  endpoint: ChainEndpoint
  signer: OfflineDirectSigner
  signerAddress: string
  msgs: readonly EncodeObject[]
  memo?: string
}): Promise<number> {
  const client = await SigningStargateClient.connectWithSigner(
    params.endpoint.rpc,
    params.signer,
  )
  try {
    return await client.simulate(params.signerAddress, [...params.msgs], params.memo)
  } finally {
    client.disconnect()
  }
}

/**
 * Convert simulated gas to a recommended gas budget with the project
 * safety margin applied. Rounded up to the nearest 1000 for tidiness +
 * to avoid sub-unit precision drift between simulation runs.
 */
export function recommendedGas(simulated: number): number {
  return Math.ceil((simulated * GAS_SAFETY_MULTIPLIER) / 1000) * 1000
}
