import { Trans, useLingui } from '@lingui/react/macro'
import { ChevronDown } from 'lucide-react'
import { useState } from 'react'

import { useActiveEndpoint } from '@/lib/chain'
import { nundToFund } from '@/lib/msgs/send'
import { useStreamEvents, type StreamEvent } from '@/lib/stream'
import { cn } from '@/lib/utils'

interface StreamHistoryPanelProps {
  sender: string
  receiver: string
}

/**
 * Per-stream audit timeline: every chain event for the `(sender, receiver)`
 * pair — Create / TopUp / Claim / Update / Cancel — rendered chronologically
 * (newest first). Lazy-fetches via `useStreamEvents` only when expanded; the
 * 5 parallel `tx_search` calls are non-trivial cost.
 *
 * Same component works for both incoming and outgoing rows — the timeline
 * is symmetric (chain emits the same events regardless of which side opens
 * the panel).
 */
export function StreamHistoryPanel({ sender, receiver }: StreamHistoryPanelProps) {
  const [open, setOpen] = useState(false)
  const { t } = useLingui()
  const endpoint = useActiveEndpoint()
  const { data, isLoading, error } = useStreamEvents(
    open ? sender : null,
    open ? receiver : null,
  )

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors self-end font-mono uppercase tracking-[0.06em]"
      >
        <Trans>Stream history</Trans>
        <ChevronDown
          aria-hidden
          className={cn('h-3 w-3 transition-transform', open && 'rotate-180')}
        />
      </button>
      {open && (
        <div className="flex flex-col gap-1 rounded border border-border bg-surface-sunk p-2 text-[11px]">
          {isLoading && (
            <p className="text-muted-foreground italic">
              <Trans>Loading stream events…</Trans>
            </p>
          )}
          {error && (
            <p className="text-destructive break-words">
              <Trans>Failed to load: {String(error)}</Trans>
            </p>
          )}
          {!isLoading && !error && (data ?? []).length === 0 && (
            <p className="text-muted-foreground italic">
              <Trans>No events yet.</Trans>
            </p>
          )}
          {(data ?? []).length > 0 && (
            <ul className="flex flex-col gap-1">
              {(data ?? []).map((e) => (
                <StreamEventRow
                  key={`${e.hash}:${e.kind}:${String(e.eventIndex)}`}
                  event={e}
                  {...(endpoint.txExplorerBase ? { explorerBase: endpoint.txExplorerBase } : {})}
                  t={t}
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

interface StreamEventRowProps {
  event: StreamEvent
  explorerBase?: string
  t: ReturnType<typeof useLingui>['t']
}

function StreamEventRow({ event, explorerBase }: StreamEventRowProps) {
  const explorerUrl = explorerBase ? `${explorerBase}${event.hash.toUpperCase()}` : null
  const denomLabel = event.denom === 'nund' ? 'FUND' : event.denom

  return (
    <li className="flex items-center justify-between gap-2 font-mono tabular-nums">
      <span className="flex flex-col min-w-0">
        <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.06em]">
          <EventKindBadge kind={event.kind} />
          <span className="text-muted-foreground">
            <Trans>Block {event.height.toLocaleString()}</Trans>
          </span>
        </span>
        <span className="truncate text-[10px] text-muted-foreground" title={event.hash}>
          {explorerUrl ? (
            <a
              href={explorerUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="underline-offset-2 hover:underline"
            >
              {event.hash.slice(0, 8)}…
            </a>
          ) : (
            <>{event.hash.slice(0, 8)}…</>
          )}
        </span>
      </span>
      <span className="flex flex-col items-end text-right">
        {event.amountNund !== undefined && event.amountLabel && (
          <>
            <span className="text-[10px] text-muted-foreground uppercase tracking-[0.06em]">
              <EventAmountLabel label={event.amountLabel} />
            </span>
            <span className="font-medium">
              {nundToFund(event.amountNund)} {denomLabel}
            </span>
          </>
        )}
        {event.secondary && (
          <span className="text-[10px] text-muted-foreground">{event.secondary}</span>
        )}
      </span>
    </li>
  )
}

function EventKindBadge({ kind }: { kind: StreamEvent['kind'] }) {
  // Per-kind accent colour. `claim` + `topup` are positive moves on stream
  // health (more funds flowing); `cancel` is destructive; `update` + `create`
  // are neutral structural changes.
  const cls = (() => {
    switch (kind) {
      case 'claim':
        return 'bg-success/15 text-success'
      case 'topup':
        return 'bg-primary/15 text-primary'
      case 'cancel':
        return 'bg-destructive/15 text-destructive'
      case 'update':
        return 'bg-accent text-accent-foreground'
      case 'create':
      default:
        return 'bg-muted text-muted-foreground'
    }
  })()
  return (
    <span className={cn('px-1 rounded font-semibold', cls)}>
      <EventKindLabel kind={kind} />
    </span>
  )
}

function EventKindLabel({ kind }: { kind: StreamEvent['kind'] }) {
  switch (kind) {
    case 'create':
      return <Trans>Created</Trans>
    case 'topup':
      return <Trans>Top up</Trans>
    case 'claim':
      return <Trans>Claim</Trans>
    case 'update':
      return <Trans>Flow rate</Trans>
    case 'cancel':
      return <Trans>Cancelled</Trans>
  }
}

function EventAmountLabel({ label }: { label: NonNullable<StreamEvent['amountLabel']> }) {
  switch (label) {
    case 'received':
      return <Trans>Received</Trans>
    case 'deposited':
      return <Trans>Deposited</Trans>
    case 'refunded':
      return <Trans>Refunded</Trans>
  }
}
