import {
  QueryClient,
  setupDistributionExtension,
  setupStakingExtension,
  type DistributionExtension,
  type StakingExtension,
} from '@cosmjs/stargate'
import { Comet38Client } from '@cosmjs/tendermint-rpc'
import { useQuery } from '@tanstack/react-query'

import { useActiveEndpoint } from './chain'

// ---------------------------------------------------------------------------
// Module note — fundjs-react vs cosmjs choice (2026-05-21)
// ---------------------------------------------------------------------------
// The M2 tracker called for targeted `@unification-com/fundjs-react/cosmos/
// staking/...` imports. That path turned out to break the production Rollup
// build under the current `link:`-installed fundjs-react (pure CommonJS, no
// `__esModule` shimming on sub-paths); Vite's optimizeDeps would fix dev
// mode but not production. The same data is available via cosmjs's already-
// bundled StargateClient + StakingExtension at zero extra bundle cost (cosmjs
// is in the vendor-cosmjs chunk regardless).
//
// Revisit at Stage 10 — once fundjs-react publishes to npm with proper ESM
// + CJS dual-export (or a sub-path build that Rollup tree-shakes cleanly),
// swap the cosmjs path for fundjs-react's typed query hooks. Tracked as a
// follow-up in M2.1 close-out notes (no floating tech debt: lands when the
// dep ships, with the swap-in being a search-and-replace on this file).
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Types — mirror the cosmjs / proto shapes we consume. Keeping these
// inline (rather than importing fundjs-react types) avoids a TS-only
// dependency that drags in resolution friction during transitions.
// ---------------------------------------------------------------------------

export interface ValidatorDescription {
  moniker: string
  identity: string
  website: string
  details: string
  securityContact: string
}

export interface ValidatorCommissionRates {
  rate: string
  maxRate: string
  maxChangeRate: string
}

export interface Validator {
  operatorAddress: string
  consensusPubkey: { typeUrl: string; value: Uint8Array } | undefined
  jailed: boolean
  status: BondStatus
  tokens: string
  delegatorShares: string
  description: ValidatorDescription
  unbondingHeight: bigint
  unbondingTime: Date | undefined
  commission: { commissionRates: ValidatorCommissionRates; updateTime: Date | undefined } | undefined
  minSelfDelegation: string
}

/**
 * Mirror of the SDK `cosmos.staking.v1beta1.BondStatus` proto enum.
 */
export const BOND_STATUS_UNSPECIFIED = 0
export const BOND_STATUS_UNBONDED = 1
export const BOND_STATUS_UNBONDING = 2
export const BOND_STATUS_BONDED = 3

export type BondStatus = 0 | 1 | 2 | 3

// ---------------------------------------------------------------------------
// Pure helpers — testable without React.
// ---------------------------------------------------------------------------

/**
 * `BOND_STATUS_BONDED` is the only "active validator set" status; everything
 * else (UNBONDED / UNBONDING / UNSPECIFIED) means the validator is not in
 * the active set and not earning rewards for delegators.
 */
export function isActiveValidator(v: Validator): boolean {
  return Number(v.status) === BOND_STATUS_BONDED
}

/**
 * Voting-power sort key. cosmjs returns `tokens` as a stringified integer;
 * compare via BigInt to avoid float precision loss on the high end of the
 * validator set.
 */
function tokensCompare(a: Validator, b: Validator): number {
  const ta = BigInt(a.tokens || '0')
  const tb = BigInt(b.tokens || '0')
  if (ta === tb) return 0
  return ta > tb ? -1 : 1
}

/**
 * Sort validators by voting power desc (active first, then inactive).
 * Active validators always rank above inactive ones regardless of token
 * count so the user's eye lands on the actionable set first.
 */
export function sortValidators(validators: readonly Validator[]): Validator[] {
  return [...validators].sort((a, b) => {
    const aa = isActiveValidator(a)
    const ab = isActiveValidator(b)
    if (aa !== ab) return aa ? -1 : 1
    return tokensCompare(a, b)
  })
}

/** Commission rate as a 0..1 number — converts the proto `Dec` string. */
export function commissionRate(v: Validator): number {
  const raw = v.commission?.commissionRates?.rate ?? '0'
  // proto Dec is stored as integer * 10^18 (e.g. "100000000000000000" = 0.1).
  try {
    const big = BigInt(raw)
    const denom = 1_000_000_000_000_000_000n
    // Multiply first to keep precision before the float divide.
    const scaled = (big * 10_000n) / denom
    return Number(scaled) / 10_000
  } catch {
    return 0
  }
}

// ---------------------------------------------------------------------------
// Query client setup — cosmjs StakingExtension over Comet38 RPC
// ---------------------------------------------------------------------------

type StakingQueryClient = QueryClient & StakingExtension & DistributionExtension

async function makeStakingClient(rpc: string): Promise<{
  client: StakingQueryClient
  disconnect: () => void
}> {
  const cometClient = await Comet38Client.connect(rpc)
  const client = QueryClient.withExtensions(
    cometClient,
    setupStakingExtension,
    setupDistributionExtension,
  )
  return {
    client,
    disconnect: () => cometClient.disconnect(),
  }
}

// ---------------------------------------------------------------------------
// React hooks — TanStack Query wrappers.
// ---------------------------------------------------------------------------

/**
 * All validators (every status — filtering / sorting / searching is the
 * caller's responsibility via `sortValidators` etc.).
 */
export function useValidators() {
  const endpoint = useActiveEndpoint()
  return useQuery({
    queryKey: ['staking', 'validators', endpoint.id, endpoint.rpc],
    queryFn: async () => {
      const { client, disconnect } = await makeStakingClient(endpoint.rpc)
      try {
        // Empty string → all statuses (BONDED + UNBONDED + UNBONDING).
        const res = await client.staking.validators('')
        return res.validators as unknown as Validator[]
      } finally {
        disconnect()
      }
    },
    // Validator set changes slowly. 60s is plenty.
    refetchInterval: 60_000,
  })
}

/**
 * Active delegations for `address` (or null/empty when no signer). Each
 * entry includes the validator address + delegation shares.
 */
export function useDelegations(address: string | null) {
  const endpoint = useActiveEndpoint()
  return useQuery({
    queryKey: ['staking', 'delegations', endpoint.id, address],
    queryFn: async () => {
      if (!address) return []
      const { client, disconnect } = await makeStakingClient(endpoint.rpc)
      try {
        const res = await client.staking.delegatorDelegations(address)
        return res.delegationResponses
      } finally {
        disconnect()
      }
    },
    enabled: !!address,
    refetchInterval: 12_000,
  })
}

/** Unbonding delegations in flight for `address`. */
export function useUnbondingDelegations(address: string | null) {
  const endpoint = useActiveEndpoint()
  return useQuery({
    queryKey: ['staking', 'unbondings', endpoint.id, address],
    queryFn: async () => {
      if (!address) return []
      const { client, disconnect } = await makeStakingClient(endpoint.rpc)
      try {
        const res = await client.staking.delegatorUnbondingDelegations(address)
        return res.unbondingResponses
      } finally {
        disconnect()
      }
    },
    enabled: !!address,
    refetchInterval: 60_000,
  })
}

/**
 * Pending rewards for `address` across all delegated validators. Returns
 * `{ rewards: ValidatorReward[], total: Coin[] }` — per-validator breakdown
 * plus the aggregated total across all delegations.
 */
export function useDelegatorRewards(address: string | null) {
  const endpoint = useActiveEndpoint()
  return useQuery({
    queryKey: ['staking', 'rewards', endpoint.id, address],
    queryFn: async () => {
      if (!address) return { rewards: [], total: [] }
      const { client, disconnect } = await makeStakingClient(endpoint.rpc)
      try {
        const res = await client.distribution.delegationTotalRewards(address)
        return { rewards: res.rewards, total: res.total }
      } finally {
        disconnect()
      }
    },
    enabled: !!address,
    refetchInterval: 30_000,
  })
}

/** Redelegations in flight for `address`. */
export function useRedelegations(address: string | null) {
  const endpoint = useActiveEndpoint()
  return useQuery({
    queryKey: ['staking', 'redelegations', endpoint.id, address],
    queryFn: async () => {
      if (!address) return []
      const { client, disconnect } = await makeStakingClient(endpoint.rpc)
      try {
        const res = await client.staking.redelegations(address, '', '')
        return res.redelegationResponses
      } finally {
        disconnect()
      }
    },
    enabled: !!address,
    refetchInterval: 60_000,
  })
}
