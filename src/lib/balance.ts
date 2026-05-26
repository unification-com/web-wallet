import { type Coin } from '@cosmjs/proto-signing'
import { StargateClient } from '@cosmjs/stargate'
import { useQuery } from '@tanstack/react-query'

import { useActiveEndpoint } from './chain'
import { fundToNund, nundToFund } from './msgs/send'

export interface BalanceResult {
  denom: string
  amount: string // raw chain-side amount (nund for the default Unification denom)
}

async function fetchBalance(
  rpc: string,
  address: string,
  denom: string,
): Promise<BalanceResult> {
  const client = await StargateClient.connect(rpc)
  try {
    const coin = await client.getBalance(address, denom)
    return { denom: coin.denom, amount: coin.amount }
  } finally {
    client.disconnect()
  }
}

// ---------------------------------------------------------------------------
// Multi-denom display helpers
// ---------------------------------------------------------------------------

/**
 * Format `amount` (raw chain-side integer string) for the given `denom`. Knows
 * the Unification 10^9 scaling for `nund` (the chain's base denom) and IBC
 * denoms (left as raw integers — IBC-wrapped tokens carry the source chain's
 * native decimals, which we'd need bank metadata or chain-registry data to
 * resolve; rendering raw is the honest default).
 *
 * Returns the formatted numeric portion only — pair with {@link displayDenom}
 * for the label.
 */
export function formatCoinAmount(amount: string, denom: string): string {
  if (denom === 'nund') return nundToFund(amount)
  // IBC denoms and unknown denoms: return the raw integer. Future work
  // (M9 IBC denom-trace + bank.denomMetadata polish) refines this.
  return amount
}

/**
 * Human-readable display label for a denom — `'FUND'` for `nund`, the raw
 * upper-case denom for non-IBC tokens, and a truncated `'ibc/AB12…'` shape
 * for IBC denoms (the full 64-char hash is unreadable; the leading prefix
 * is enough to recognise + the full denom is the row's `title` tooltip).
 */
export function displayDenom(denom: string): string {
  if (denom === 'nund') return 'FUND'
  if (denom.startsWith('ibc/')) {
    const hash = denom.slice(4)
    return `ibc/${hash.slice(0, 4)}…${hash.slice(-4)}`
  }
  return denom.toUpperCase()
}

/**
 * Convert a user-entered amount to the chain-side integer for the given
 * denom. For `nund`, scales by 10^9 (FUND → nund — the user types FUND).
 * For everything else (IBC-wrapped tokens primarily), returns the raw
 * integer as-typed; the source chain's native decimals are unknown until
 * M9 IBC denom-trace lands, so treating the input as already-chain-side is
 * the honest behaviour. Non-numeric input is stripped.
 */
export function userAmountToChain(amount: string, denom: string): string {
  if (denom === 'nund') return fundToNund(amount)
  return amount.replace(/[^0-9]/g, '') || '0'
}

/**
 * Live balance query for `address` in `denom` (default `nund`). Refetches
 * every 8 s while mounted (chains produce blocks every ~6 s; 8 s keeps us
 * within roughly one-block staleness without hammering RPCs). Send flows
 * also invalidate this query on success for instant post-broadcast feedback.
 * Disabled when `address` is null/empty.
 */
export function useBalance(address: string | null, denom = 'nund') {
  const endpoint = useActiveEndpoint()
  return useQuery({
    queryKey: ['balance', endpoint.id, address, denom],
    queryFn: async () => {
      if (!address) throw new Error('no address')
      return await fetchBalance(endpoint.rpc, address, denom)
    },
    enabled: !!address,
    refetchInterval: 8_000,
  })
}

/**
 * All bank balances held by `address` — every denom the user has, not just
 * the chain's native `nund`. Used by the `<Balances />` card and the
 * `<Send />` denom selector. Returns the raw `Coin[]` from cosmjs sorted by
 * denom for stable rendering.
 *
 * Shares the `['balance']` query-key prefix with `useBalance` so Tx success
 * invalidation patterns (`['balance']`) refresh both single-denom + all-denom
 * views in one shot — no consumer needs to be aware that both hooks exist.
 */
export function useAllBalances(address: string | null) {
  const endpoint = useActiveEndpoint()
  return useQuery({
    queryKey: ['balance', 'all', endpoint.id, address],
    queryFn: async (): Promise<readonly Coin[]> => {
      if (!address) return []
      const client = await StargateClient.connect(endpoint.rpc)
      try {
        const coins = await client.getAllBalances(address)
        return [...coins].sort((a, b) => a.denom.localeCompare(b.denom))
      } finally {
        client.disconnect()
      }
    },
    enabled: !!address,
    refetchInterval: 8_000,
  })
}
