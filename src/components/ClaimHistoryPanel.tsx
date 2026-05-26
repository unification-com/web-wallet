import { Trans, useLingui } from '@lingui/react/macro'
import { ChevronDown } from 'lucide-react'
import { useState } from 'react'

import { useActiveEndpoint } from '@/lib/chain'
import { nundToFund } from '@/lib/msgs/send'
import { useClaimHistory } from '@/lib/stream'
import { cn } from '@/lib/utils'

interface ClaimHistoryPanelProps {
  sender: string
  receiver: string
  /** Whether to render the panel for a stream this address is the receiver of
   * — toggles which amount is highlighted (incoming → received; outgoing →
   * total claimed by other party). */
  perspective: 'incoming' | 'outgoing'
}

/**
 * Per-stream collapsible claim-history panel. Lazy-fetches via
 * `useClaimHistory` only when expanded — the searchTx round-trip is
 * non-trivial so we don't want it firing for every row by default.
 */
export function ClaimHistoryPanel({ sender, receiver, perspective }: ClaimHistoryPanelProps) {
  const [open, setOpen] = useState(false)
  const { t } = useLingui()
  const endpoint = useActiveEndpoint()
  const { data, isLoading, error } = useClaimHistory(
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
        <Trans>Claim history</Trans>
        <ChevronDown
          aria-hidden
          className={cn('h-3 w-3 transition-transform', open && 'rotate-180')}
        />
      </button>
      {open && (
        <div className="flex flex-col gap-1 rounded border border-border bg-surface-sunk p-2 text-[11px]">
          {isLoading && (
            <p className="text-muted-foreground italic">
              <Trans>Loading claim history…</Trans>
            </p>
          )}
          {error && (
            <p className="text-destructive break-words">
              <Trans>Failed to load: {String(error)}</Trans>
            </p>
          )}
          {!isLoading && !error && (data ?? []).length === 0 && (
            <p className="text-muted-foreground italic">
              <Trans>No claims yet.</Trans>
            </p>
          )}
          {(data ?? []).length > 0 && (
            <ul className="flex flex-col gap-1">
              {(data ?? []).map((c) => {
                const explorerUrl = endpoint.txExplorerBase
                  ? `${endpoint.txExplorerBase}${c.hash.toUpperCase()}`
                  : null
                const denomLabel = c.denom === 'nund' ? 'FUND' : c.denom
                const headline =
                  perspective === 'incoming'
                    ? nundToFund(c.amountReceivedNund || '0')
                    : nundToFund(c.claimTotalNund || '0')
                const headlineLabel =
                  perspective === 'incoming' ? t`Received` : t`Claimed`
                return (
                  <li
                    key={c.hash}
                    className="flex items-center justify-between gap-2 font-mono tabular-nums"
                  >
                    <span className="flex flex-col min-w-0">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-[0.06em]">
                        <Trans>Block {c.height.toLocaleString()}</Trans>
                      </span>
                      <span className="truncate text-[10px] text-muted-foreground" title={c.hash}>
                        {explorerUrl ? (
                          <a
                            href={explorerUrl}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="underline-offset-2 hover:underline"
                          >
                            {c.hash.slice(0, 8)}…
                          </a>
                        ) : (
                          <>{c.hash.slice(0, 8)}…</>
                        )}
                      </span>
                    </span>
                    <span className="flex flex-col items-end">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-[0.06em]">
                        {headlineLabel}
                      </span>
                      <span className="font-medium">
                        {headline} {denomLabel}
                      </span>
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
