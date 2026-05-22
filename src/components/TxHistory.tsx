import { Trans } from '@lingui/react/macro'
import { useState } from 'react'

import { RefreshButton } from '@/components/RefreshButton'
import { TxRow } from '@/components/TxRow'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useActiveSigner } from '@/lib/signer'
import { useTxHistory } from '@/lib/txhistory'

/**
 * Tx-history view for the active wallet account. Calls `useTxHistory`
 * (cosmjs `searchTx` for `message.sender` + `transfer.recipient`, merged
 * + deduped + sorted desc), then renders via the shared `<TxRow />` which
 * routes each Msg through the declarative presenter map.
 *
 * Initial display caps the visible list at `PAGE_SIZE` entries; a "Load
 * more" button reveals more in the same page. `searchTx` already paged
 * through all results server-side, so this is purely a UI cap to keep
 * the initial render fast for long histories.
 */
const PAGE_SIZE = 30

export function TxHistory() {
  const { address } = useActiveSigner()
  const { data: txs, isLoading, isError, error } = useTxHistory(address)
  const [visible, setVisible] = useState(PAGE_SIZE)

  if (!address) return null

  const all = txs ?? []
  const shown = all.slice(0, visible)
  const more = all.length - shown.length

  return (
    <Card>
      <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm">
          <Trans>History</Trans>
        </CardTitle>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground">
            <Trans>{all.length.toString()} txs</Trans>
          </span>
          <RefreshButton queryKeys={[['txhistory']]} />
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-2 flex flex-col gap-2 text-xs">
        {isLoading && (
          <p className="text-muted-foreground">
            <Trans>Loading history…</Trans>
          </p>
        )}
        {isError && (
          <p className="text-destructive">
            <Trans>
              Failed to load history: {error instanceof Error ? error.message : String(error)}
            </Trans>
          </p>
        )}
        {!isLoading && !isError && all.length === 0 && (
          <p className="text-muted-foreground italic">
            <Trans>
              No txs found for this account yet. Send or receive FUND to see your activity
              here.
            </Trans>
          </p>
        )}
        <ul className="flex flex-col gap-2">
          {shown.map((tx) => (
            <TxRow key={tx.hash} tx={tx} activeAddress={address} />
          ))}
        </ul>
        {more > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="self-center h-7 text-xs mt-1"
            onClick={() => setVisible((v) => v + PAGE_SIZE)}
          >
            <Trans>Load {Math.min(more, PAGE_SIZE).toString()} more</Trans>
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
