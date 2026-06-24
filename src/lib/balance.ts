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
 * FUND returning home through an IBC channel). For other denoms callers may
 * pass an explicit `decimals` exponent — typically resolved via the
 * cosmos.directory registry's per-chain `decimals` field — to scale wrapped
 * tokens to their human-readable form (e.g. `uatom` → divide by 10^6).
 * Without `decimals`, returns the raw integer (honest fallback when no
 * metadata is available).
 *
 * Returns the formatted numeric portion only — pair with {@link displayDenom}
 * for the label.
 */
export function formatCoinAmount(amount: string, denom: string, decimals?: number): string {
  if (getBaseDenom(denom) === 'nund') return nundToFund(amount)
  if (typeof decimals === 'number' && decimals > 0) return scaleByDecimals(amount, decimals)
  return amount
}

/**
 * Divide `amount` (raw integer string) by 10^`decimals`, trimming trailing
 * zeros in the fractional part. BigInt-precision so foreign-chain tokens
 * with `decimals=18` (Ethereum-style) round-trip without precision loss.
 * Returns `'0'` on unparseable input.
 */
export function scaleByDecimals(amount: string, decimals: number): string {
  if (decimals <= 0) return amount
  try {
    const intPart = amount.split('.')[0] ?? '0'
    const big = BigInt(intPart)
    const scale = 10n ** BigInt(decimals)
    const whole = big / scale
    const frac = (big % scale).toString().padStart(decimals, '0').replace(/0+$/, '')
    return frac ? `${whole.toString()}.${frac}` : whole.toString()
  } catch {
    return '0'
  }
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
 * denom. For `nund` (and wrapped `transfer/.../nund`), scales by 10^9
 * (FUND → nund — the user types FUND). For other denoms, callers can pass
 * an explicit `decimals` exponent (typically from the cosmos.directory
 * registry, e.g. 6 for ATOM/OSMO/JUNO, 18 for Ethereum-style assets) to
 * scale `1.5` → `1500000`. Without `decimals`, the raw integer is taken
 * as-typed (honest fallback — but caller should warn the user).
 */
export function userAmountToChain(amount: string, denom: string, decimals?: number): string {
  if (getBaseDenom(denom) === 'nund') return fundToNund(amount)
  if (typeof decimals === 'number' && decimals > 0) return scaleToInteger(amount, decimals)
  return amount.replace(/[^0-9]/g, '') || '0'
}

/**
 * Multiply a decimal-string `amount` by 10^`decimals` to produce the
 * chain-side integer. Inverse of {@link scaleByDecimals}. Handles
 * unprintable / malformed input by stripping to 0. BigInt-precision so
 * 18-decimal Ethereum-style tokens round-trip without loss.
 */
export function scaleToInteger(amount: string, decimals: number): string {
  if (decimals <= 0) return amount.replace(/[^0-9]/g, '') || '0'
  const trimmed = amount.trim()
  if (!trimmed) return '0'
  const [intPart = '0', fracRaw = ''] = trimmed.split('.')
  const intDigits = intPart.replace(/[^0-9]/g, '')
  const fracDigits = fracRaw.replace(/[^0-9]/g, '').slice(0, decimals).padEnd(decimals, '0')
  try {
    const big = BigInt(intDigits || '0') * 10n ** BigInt(decimals) + BigInt(fracDigits || '0')
    return big.toString()
  } catch {
    return '0'
  }
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
