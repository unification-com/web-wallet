import { Trans } from '@lingui/react/macro'

import { RefreshButton } from '@/components/RefreshButton'
import { TxRow } from '@/components/TxRow'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useActiveSigner } from '@/lib/signer'
import { useTxHistory } from '@/lib/txhistory'

/**
 * Tx-history view for the active wallet account. Consumes `useTxHistory`'s
 * cursor-paginated stream — each "Load more" click fetches the next page
 * of `message.sender=address` + `transfer.recipient=address` (server-side
 * via Tendermint's `tx_search`). Avoids the previous all-at-once fetch
 * that timed out on accounts with thousands of txs.
 */
export function TxHistory() {
  const { address } = useActiveSigner()
  const {
    data,
    isLoading,
    isError,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useTxHistory(address)

  if (!address) return null

  const allTxs = data?.pages.flatMap((p) => p.txs) ?? []

  return (
    <Card>
      <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm">
          <Trans>History</Trans>
        </CardTitle>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground">
            <Trans>{allTxs.length.toString()} shown</Trans>
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
        {!isLoading && !isError && allTxs.length === 0 && (
          <p className="text-muted-foreground italic">
            <Trans>
              No txs found for this account yet. Send or receive FUND to see your activity
              here.
            </Trans>
          </p>
        )}
        <ul className="flex flex-col gap-2">
          {allTxs.map((tx) => (
            <TxRow key={tx.hash} tx={tx} activeAddress={address} />
          ))}
        </ul>
        {hasNextPage && (
          <Button
            variant="outline"
            size="sm"
            className="self-center h-7 text-xs mt-1"
            disabled={isFetchingNextPage}
            // eslint-disable-next-line @typescript-eslint/no-misused-promises
            onClick={() => fetchNextPage()}
          >
            {isFetchingNextPage ? <Trans>Loading…</Trans> : <Trans>Load more</Trans>}
          </Button>
        )}
        {/* Honest footnote about tx-index pruning: public RPCs typically
         *  retain only recent-block tx events, so very old activity may
         *  not appear here even when the chain itself still has the txs.
         *  M12 Phase 2 will add a block-explorer link for full history. */}
        {!isLoading && !isError && allTxs.length > 0 && (
          <p className="text-[10px] text-muted-foreground italic pt-1">
            <Trans>
              Showing txs indexed by this RPC. Public nodes typically prune older
              entries from the tx index — for full history, see your account on a block
              explorer.
            </Trans>
          </p>
        )}
      </CardContent>
    </Card>
  )
}
