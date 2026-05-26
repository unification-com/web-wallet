import { Trans, useLingui } from '@lingui/react/macro'

import { RefreshButton } from '@/components/RefreshButton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { displayDenom, formatCoinAmount, useAllBalances } from '@/lib/balance'
import { useActiveSigner } from '@/lib/signer'

/**
 * Multi-denom balance card. Lists every denom held by the active address —
 * native `nund` (rendered as FUND) plus any IBC-wrapped tokens received from
 * other chains.
 *
 * IBC denom hashes are rendered truncated (`ibc/AB12…CD34`) with the full
 * hash available via tooltip; resolving them to friendly labels (e.g. "ATOM
 * from Cosmos Hub") needs `ibc.applications.transfer.v1.QueryDenomTrace`
 * which is properly homed in M9 IBC alongside the rest of cross-chain work.
 * For pre-M9, the truncated hash is the honest representation.
 */
export function Balances() {
  const { address } = useActiveSigner()
  const { data: balances, isLoading } = useAllBalances(address)
  const { t } = useLingui()

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
            {rows.map((coin) => {
              const isIbc = coin.denom.startsWith('ibc/')
              return (
                <li
                  key={coin.denom}
                  className="flex items-center justify-between gap-2 rounded border border-border p-2"
                  title={isIbc ? coin.denom : undefined}
                >
                  <span className="flex flex-col min-w-0">
                    <span className="font-medium">{displayDenom(coin.denom)}</span>
                    {isIbc && (
                      <span className="font-mono text-[10px] text-muted-foreground">
                        <Trans>IBC-wrapped</Trans>
                      </span>
                    )}
                  </span>
                  <span
                    className="font-mono font-medium tabular-nums"
                    title={
                      isIbc
                        ? t`Raw amount — decimals unknown until M9 IBC denom-trace lands.`
                        : undefined
                    }
                  >
                    {formatCoinAmount(coin.amount, coin.denom)}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
