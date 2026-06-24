import { type Coin } from '@cosmjs/proto-signing'
import { Trans, useLingui } from '@lingui/react/macro'

import { RefreshButton } from '@/components/RefreshButton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCoinAmount, useAllBalances } from '@/lib/balance'
import { useDenomTrace, useResolvedDenom } from '@/lib/ibc'
import { useActiveSigner } from '@/lib/signer'

/**
 * Multi-denom balance card. Lists every denom held by the active address —
 * native `nund` (rendered as FUND) plus any IBC-wrapped tokens received from
 * other chains.
 *
 * For IBC denoms (`ibc/<hash>`), we run `useDenomTrace` per row to surface
 * the base denom + source channel, then cross-reference channels from
 * `useIbcChannels` to render "ATOM (via osmosis-1)" rather than an opaque
 * hash. Both queries cache aggressively (denom traces never change; channels
 * change rarely), so the cost amortises across renders.
 */
export function Balances() {
  const { address } = useActiveSigner()
  const { data: balances, isLoading } = useAllBalances(address)

  if (!address) return null

  const rows = balances ?? []

  return (
    <Card>
      <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0 gap-2">
        <CardTitle className="text-sm">
          <Trans>Balances</Trans>
        </CardTitle>
        <RefreshButton queryKeys={[['balance']]} />
      </CardHeader>
      <CardContent className="p-4 pt-2 flex flex-col gap-2 text-xs">
        {isLoading && (
          <p className="text-muted-foreground">
            <Trans>Loading balances…</Trans>
          </p>
        )}
        {!isLoading && rows.length === 0 && (
          <p className="text-muted-foreground italic">
            <Trans>No balances yet — receive some FUND to get started.</Trans>
          </p>
        )}
        {rows.length > 0 && (
          <ul className="flex flex-col gap-1">
            {rows.map((coin) => (
              <BalanceRow key={coin.denom} coin={coin} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * Single row. Extracted so each row can run its own conditional
 * `useDenomTrace` — `enabled` gating in the hook keeps non-IBC rows
 * zero-cost (the query never fires for a `denom !== 'ibc/…'`).
 */
function BalanceRow({ coin }: { coin: Coin }) {
  const { t } = useLingui()
  const isIbc = coin.denom.startsWith('ibc/')
  const trace = useDenomTrace(isIbc ? coin.denom : null)
  const resolved = useResolvedDenom(coin.denom)

  const primary = resolved.chainLabel
    ? `${resolved.symbol} (via ${resolved.chainLabel})`
    : resolved.symbol

  return (
    <li
      className="flex items-center justify-between gap-2 rounded border border-border p-2"
      title={isIbc ? coin.denom : undefined}
    >
      <span className="flex flex-col min-w-0">
        <span className="font-medium truncate">{primary}</span>
        {isIbc && (
          <span className="font-mono text-[10px] text-muted-foreground">
            {trace.data ? (
              <Trans>{trace.data.path}</Trans>
            ) : trace.isLoading ? (
              <Trans>resolving denom trace…</Trans>
            ) : (
              <Trans>IBC-wrapped</Trans>
            )}
          </span>
        )}
      </span>
      <span
        className="font-mono font-medium tabular-nums"
        title={
          isIbc && typeof resolved.decimals !== 'number'
            ? t`Raw amount — source chain's decimals not in registry; rendering integer.`
            : undefined
        }
      >
        {formatCoinAmount(coin.amount, coin.denom, resolved.decimals)}
      </span>
    </li>
  )
}
