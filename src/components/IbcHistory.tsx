import { Trans, useLingui } from '@lingui/react/macro'
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react'

import { AddressLink } from '@/components/AddressLink'
import { RefreshButton } from '@/components/RefreshButton'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { displayDenom, formatCoinAmount } from '@/lib/balance'
import { useActiveEndpoint } from '@/lib/chain'
import { useChainByChainId } from '@/lib/cosmosRegistry'
import {
  useBlockTime,
  useCounterpartPacketTx,
  useCounterpartyAccountUrl,
  useIbcChannels,
  useIbcHistory,
  usePacketStatus,
  type IbcPacket,
  type IbcPacketStatus,
} from '@/lib/ibc'
import { useActiveSigner } from '@/lib/signer'
import { formatRelativeDeadline } from '@/lib/time'
import { cn } from '@/lib/utils'

/**
 * IBC packet history table — paginated. Outbound + inbound packets fetched
 * one page per "Load more" click; per-row status (acknowledged / timed-out
 * for outbound) + block-time resolved on demand by `usePacketStatus` and
 * `useBlockTime`. For accounts with thousands of packets the initial page
 * loads in seconds rather than minutes.
 */
export function IbcHistory() {
  const { address } = useActiveSigner()
  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useIbcHistory(address)
  const { data: channels } = useIbcChannels()
  const endpoint = useActiveEndpoint()
  const { t } = useLingui()

  if (!address) return null

  const rows = data?.pages.flatMap((p) => p.packets) ?? []

  return (
    <Card>
      <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0 gap-2">
        <CardTitle className="text-sm">
          <Trans>IBC packet history</Trans>
        </CardTitle>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground">
            <Trans>{rows.length.toString()} shown</Trans>
          </span>
          <RefreshButton queryKeys={[['ibc', 'history']]} />
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-2 flex flex-col gap-2 text-xs">
        {isLoading && (
          <p className="text-muted-foreground">
            <Trans>Loading IBC history…</Trans>
          </p>
        )}
        {!isLoading && rows.length === 0 && (
          <p className="text-muted-foreground italic">
            <Trans>No IBC transfers yet.</Trans>
          </p>
        )}
        {rows.length > 0 && (
          <ul className="flex flex-col gap-1">
            {rows.map((p) => (
              <PacketRow
                key={`${p.direction}-${p.channelId}-${p.sequence}-${p.txHash}`}
                packet={p}
                channels={channels ?? []}
                explorerBase={endpoint.txExplorerBase}
                t={t}
              />
            ))}
          </ul>
        )}
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
      </CardContent>
    </Card>
  )
}

interface PacketRowProps {
  packet: IbcPacket
  channels: { channelId: string; counterpartyChainId: string }[]
  explorerBase: string | undefined
  t: ReturnType<typeof useLingui>['t']
}

function PacketRow({ packet, channels, explorerBase, t }: PacketRowProps) {
  const isOutbound = packet.direction === 'outbound'
  const explorerUrl = explorerBase
    ? `${explorerBase}${packet.txHash.toUpperCase()}`
    : null
  const channelInfo = channels.find((c) => c.channelId === packet.channelId)
  const counterpartyChainId = channelInfo?.counterpartyChainId ?? ''
  // Cosmos registry lookup — gives us pretty_name (e.g. "Gravity Bridge" vs
  // raw "gravity-bridge-3") plus access to bech32_prefix for label hints.
  const counterpartyEntry = useChainByChainId(counterpartyChainId)
  const counterpartyChain =
    counterpartyEntry?.pretty_name ?? (counterpartyChainId || '?')

  // Per-row status: outbound is enriched by usePacketStatus (returns
  // acknowledged / timed-out / in-transit). Inbound's status is already
  // set on the packet itself from the recv tx's fungible_token_packet.success.
  const statusQuery = usePacketStatus(packet.direction, packet.channelId, packet.sequence)
  const displayStatus: IbcPacketStatus = isOutbound
    ? (statusQuery.data ?? packet.status)
    : packet.status

  // Per-row block time. React Query dedupes parallel requests for the same
  // height, so multiple packets in one block resolve via one round-trip.
  const blockTime = useBlockTime(packet.height)

  // Counterpart-chain enrichment — cross-chain tx lookup via the chain's
  // cosmos.directory RPC list. Resolves "where did this packet land /
  // come from" + an explorer deep-link.
  const counterpart = useCounterpartPacketTx(packet)
  const counterpartyAccountUrl = useCounterpartyAccountUrl(
    counterpartyChainId,
    packet.counterparty,
  )

  // Registry-driven denom enrichment for inbound rows. Inbound packets'
  // `denom` is the counterparty chain's native base denom (e.g. `uatom`);
  // the registry entry's `denom` + `symbol` + `decimals` give us
  // human-readable label + scaling. Outbound rows are typically our `nund`
  // — formatCoinAmount handles those natively. Multi-hop or wrapped-back
  // forwarding cases fall through to the raw-display default.
  const useCounterpartyAsset =
    !isOutbound && counterpartyEntry?.denom === packet.denom
  const amountDecimals = useCounterpartyAsset ? counterpartyEntry?.decimals : undefined
  const amountSymbol =
    useCounterpartyAsset && counterpartyEntry?.symbol
      ? counterpartyEntry.symbol
      : displayDenom(packet.denom)

  return (
    <li
      className="flex flex-col gap-1 rounded border border-border p-2"
      title={t`Block ${packet.height.toLocaleString()} · sequence ${packet.sequence} · channel ${packet.channelId}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 min-w-0">
          <span
            className={cn(
              'inline-flex items-center justify-center h-5 w-5 rounded shrink-0',
              isOutbound
                ? 'bg-muted text-muted-foreground'
                : 'bg-success/15 text-success',
            )}
          >
            {isOutbound ? (
              <ArrowUpRight className="h-3 w-3" aria-hidden />
            ) : (
              <ArrowDownLeft className="h-3 w-3" aria-hidden />
            )}
          </span>
          <span className="flex flex-col min-w-0">
            <span className="text-[10px] uppercase tracking-[0.06em] text-muted-foreground font-mono">
              {isOutbound ? <Trans>To</Trans> : <Trans>From</Trans>}
              {' · '}
              <span>{counterpartyChain}</span>
            </span>
            <AddressLink
              address={packet.counterparty}
              url={counterpartyAccountUrl}
              className="text-[10px] truncate"
            />
          </span>
        </span>
        <span className="flex flex-col items-end shrink-0">
          <PacketStatusChip status={displayStatus} />
          <span className="font-mono tabular-nums">
            {formatCoinAmount(packet.amount, packet.denom, amountDecimals)} {amountSymbol}
          </span>
        </span>
      </div>
      <div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground font-mono">
        <span title={blockTime.data?.toISOString()}>
          {blockTime.data ? (
            <>
              {blockTime.data.toLocaleString()}{' '}
              <span className="opacity-70">
                ({formatRelativeDeadline(blockTime.data).label})
              </span>
            </>
          ) : (
            <Trans>block {packet.height.toLocaleString()}</Trans>
          )}
        </span>
        {explorerUrl ? (
          <a
            href={explorerUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="underline-offset-2 hover:underline"
          >
            {packet.txHash.slice(0, 8)}…
          </a>
        ) : (
          <span>{packet.txHash.slice(0, 8)}…</span>
        )}
      </div>
      <div className="text-[10px] text-muted-foreground font-mono">
        {packet.channelId} · seq {packet.sequence}
      </div>
      {/* Counterpart-chain enrichment — appears once the cosmos.directory
       *  RPC lookup resolves the matching recv_packet (outbound) or
       *  send_packet (inbound) on the other side. Loading + missing states
       *  rendered separately so the user can see when enrichment failed vs
       *  is still in flight. */}
      {counterpart.isLoading && (
        <div className="text-[10px] text-muted-foreground font-mono italic">
          {isOutbound ? (
            <Trans>Looking up receipt on counterpart chain…</Trans>
          ) : (
            <Trans>Looking up source tx on counterpart chain…</Trans>
          )}
        </div>
      )}
      {!counterpart.isLoading && counterpart.data && (
        <div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground font-mono">
          <span>
            {isOutbound ? (
              <Trans>Received on {counterpart.data.chainPrettyName} · block {counterpart.data.height.toLocaleString()}</Trans>
            ) : (
              <Trans>Sent from {counterpart.data.chainPrettyName} · block {counterpart.data.height.toLocaleString()}</Trans>
            )}
          </span>
          {counterpart.data.explorerUrl ? (
            <a
              href={counterpart.data.explorerUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="underline-offset-2 hover:underline"
            >
              {counterpart.data.txHash.slice(0, 8)}…
            </a>
          ) : (
            <span title={counterpart.data.txHash}>{counterpart.data.txHash.slice(0, 8)}…</span>
          )}
        </div>
      )}
      {!counterpart.isLoading &&
        counterpart.isFetched &&
        !counterpart.data &&
        (displayStatus === 'acknowledged' || displayStatus === 'received') && (
          <div className="text-[10px] text-muted-foreground font-mono italic">
            <Trans>Counterpart tx not found (RPC pruning or CORS blocked)</Trans>
          </div>
        )}
    </li>
  )
}

function PacketStatusChip({ status }: { status: IbcPacketStatus }) {
  const cls = (() => {
    switch (status) {
      case 'acknowledged':
      case 'received':
        return 'bg-success/15 text-success'
      case 'in-transit':
        return 'bg-accent text-accent-foreground'
      case 'timed-out':
      case 'failed':
        return 'bg-destructive/15 text-destructive'
    }
  })()
  return (
    <span
      className={
        'px-1.5 py-0.5 rounded font-mono uppercase tracking-[0.06em] text-[9px] font-semibold ' +
        cls
      }
    >
      <PacketStatusLabel status={status} />
    </span>
  )
}

function PacketStatusLabel({ status }: { status: IbcPacketStatus }) {
  switch (status) {
    case 'in-transit':
      return <Trans>In transit</Trans>
    case 'acknowledged':
      return <Trans>Acknowledged</Trans>
    case 'timed-out':
      return <Trans>Timed out</Trans>
    case 'received':
      return <Trans>Received</Trans>
    case 'failed':
      return <Trans>Failed</Trans>
  }
}
