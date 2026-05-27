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
 * Strip all `transfer/channel-X/` IBC-voucher prefixes from a denom to expose
 * the underlying base denom. `nund` → `nund`; `transfer/channel-2/nund` →
 * `nund` (wrapped FUND returning home); `transfer/channel-98/transfer/channel-X/uatom`
 * → `uatom` (multi-hop ATOM). Stops on the first segment that isn't a
 * well-formed `transfer/channel-N` pair so non-IBC denoms pass through.
 *
 * Exported because the IBC history view needs the same logic for packet-data
 * denoms (which use the `transfer/...` form on the wire even when the token
 * is unwrapped to native on receipt).
 */
export function getBaseDenom(denom: string): string {
  let result = denom
  while (result.startsWith('transfer/')) {
    const parts = result.split('/')
    if (parts.length >= 3 && parts[1]?.startsWith('channel-')) {
      result = parts.slice(2).join('/')
    } else {
      break
    }
  }
  return result
}

/**
 * Format `amount` (raw chain-side integer string) for the given `denom`. Knows
 * the Unification 10^9 scaling for `nund` — including wrapped variants
 * (`transfer/channel-X/nund` etc., which represent FUND on a remote chain or
 * FUND returning home through an IBC channel). IBC denoms with non-`nund`
 * base (e.g. wrapped ATOM via `transfer/channel-2/uatom`, raw `ibc/HASH`
 * forms) are left as raw integers — their source-chain decimals would need
 * bank metadata or chain-registry data to resolve correctly; rendering raw
 * is the honest default.
 *
 * Returns the formatted numeric portion only — pair with {@link displayDenom}
 * for the label.
 */
export function formatCoinAmount(amount: string, denom: string): string {
  if (getBaseDenom(denom) === 'nund') return nundToFund(amount)
  return amount
}

/**
 * Human-readable display label for a denom — `'FUND'` for `nund` and any
 * wrapped variant (since they all represent FUND), the raw upper-case
 * denom for other non-IBC tokens, and a truncated `'ibc/AB12…'` shape for
 * opaque-hash IBC denoms (the full 64-char hash is unreadable; the leading
 * prefix is enough to recognise + the full denom is the row's `title`
 * tooltip).
 */
export function displayDenom(denom: string): string {
  if (getBaseDenom(denom) === 'nund') return 'FUND'
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
