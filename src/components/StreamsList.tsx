import { Trans, useLingui } from '@lingui/react/macro'
import { Plus } from 'lucide-react'
import { useState } from 'react'

import { RefreshButton } from '@/components/RefreshButton'
import {
  CancelStreamModal,
  ClaimStreamModal,
  CreateStreamModal,
  TopUpStreamModal,
  UpdateFlowRateModal,
} from '@/components/StreamActionModals'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { nundToFund } from '@/lib/msgs/send'
import { useActiveSigner } from '@/lib/signer'
import {
  claimableNow,
  depositRemainingMs,
  formatFlowRate,
  sortStreams,
  useIncomingStreams,
  useOutgoingStreams,
  type StreamResult,
} from '@/lib/stream'
import { formatRelativeDeadline, useTickingNow } from '@/lib/time'

/**
 * Format a stream's deposit-zero countdown. Past-due ("drained") streams
 * show a destructive-coloured "drained" label rather than a stale "X days
 * ago" because the chain caps outflow at the deposit total — the stream
 * stopped paying out at depositZeroTime, no matter how long ago that was.
 */
function depositCountdown(
  s: StreamResult,
  now: Date,
): { label: string; drained: boolean } {
  const remaining = depositRemainingMs(s.stream)
  if (remaining === null) return { label: '—', drained: false }
  if (remaining <= 0) return { label: 'drained', drained: true }
  const target = s.stream?.depositZeroTime
  if (!target) return { label: '—', drained: false }
  return { label: formatRelativeDeadline(target, now).label, drained: false }
}

/**
 * Stream monitor + action surface. Renders two cards — Incoming (active
 * account is receiver) and Outgoing (active account is sender) — with
 * per-row Claim / Top up / Update / Cancel actions, plus a Create button
 * in the Outgoing card header. All five actions broadcast via the shared
 * `<TxModal />` shell.
 */
export function StreamsList() {
  const { address } = useActiveSigner()
  const incoming = useIncomingStreams(address)
  const outgoing = useOutgoingStreams(address)
  const now = useTickingNow(1_000)
  const { t } = useLingui()

  const [claimTarget, setClaimTarget] = useState<{
    source: StreamResult
    claimableNund: string
  } | null>(null)
  const [topUpTarget, setTopUpTarget] = useState<StreamResult | null>(null)
  const [updateTarget, setUpdateTarget] = useState<StreamResult | null>(null)
  const [cancelTarget, setCancelTarget] = useState<StreamResult | null>(null)
  const [createOpen, setCreateOpen] = useState(false)

  if (!address) return null

  const incomingStreams = sortStreams(incoming.data ?? [])
  const outgoingStreams = sortStreams(outgoing.data ?? [])

  return (
    <>
      <div className="flex flex-col gap-3">
        <Card>
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0 gap-2">
            <CardTitle className="text-sm">
              <Trans>Incoming streams</Trans>
            </CardTitle>
            <RefreshButton queryKeys={[['stream', 'incoming']]} />
          </CardHeader>
          <CardContent className="p-4 pt-2 flex flex-col gap-2 text-xs">
            {incoming.isLoading && (
              <p className="text-muted-foreground">
                <Trans>Loading streams…</Trans>
              </p>
            )}
            {!incoming.isLoading && incomingStreams.length === 0 && (
              <p className="text-muted-foreground italic">
                <Trans>No incoming streams.</Trans>
              </p>
            )}
            <ul className="flex flex-col gap-2">
              {incomingStreams.map((s) => {
                const flow = s.stream ? formatFlowRate(s.stream.flowRate) : null
                const claimableNund = claimableNow(s.stream)
                const claim = nundToFund(claimableNund.toString())
                const deposit = s.stream?.deposit.amount ?? '0'
                const cd = depositCountdown(s, now)
                const denomLabel = s.denom === 'nund' ? 'FUND' : s.denom
                return (
                  <li
                    key={`${s.sender}-${s.denom}`}
                    className="flex flex-col gap-1 rounded border border-border p-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex flex-col min-w-0">
                        <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.06em]">
                          <Trans>From</Trans>
                        </span>
                        <span className="font-mono text-[11px] truncate" title={s.sender}>
                          {s.sender}
                        </span>
                      </span>
                      <span className="flex flex-col items-end tabular-nums">
                        <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.06em]">
                          <Trans>Claimable</Trans>
                        </span>
                        <span className="font-mono font-medium text-success">
                          {claim} {denomLabel}
                        </span>
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground font-mono">
                      <span title={t`Flow rate`}>
                        {flow ? `${flow.amountFund} / ${flow.period}` : '—'}
                      </span>
                      <span title={t`Remaining deposit`}>
                        {nundToFund(deposit)} {denomLabel}
                      </span>
                      <span
                        className={cd.drained ? 'text-destructive' : undefined}
                        title={t`Deposit drains`}
                      >
                        {cd.label}
                      </span>
                    </div>
                    <div className="flex justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 px-2 text-[11px]"
                        disabled={claimableNund === 0n}
                        onClick={() =>
                          setClaimTarget({ source: s, claimableNund: claimableNund.toString() })
                        }
                        title={
                          claimableNund === 0n
                            ? t`Nothing claimable yet — wait for accrual.`
                            : undefined
                        }
                      >
                        <Trans>Claim</Trans>
                      </Button>
                    </div>
                  </li>
                )
              })}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0 gap-2">
            <CardTitle className="text-sm">
              <Trans>Outgoing streams</Trans>
            </CardTitle>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setCreateOpen(true)}
              >
                <Plus className="h-3 w-3 mr-1" aria-hidden />
                <Trans>Create</Trans>
              </Button>
              <RefreshButton queryKeys={[['stream', 'outgoing']]} />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-2 flex flex-col gap-2 text-xs">
            {outgoing.isLoading && (
              <p className="text-muted-foreground">
                <Trans>Loading streams…</Trans>
              </p>
            )}
            {!outgoing.isLoading && outgoingStreams.length === 0 && (
              <p className="text-muted-foreground italic">
                <Trans>No outgoing streams. Use Create to open one.</Trans>
              </p>
            )}
            <ul className="flex flex-col gap-2">
              {outgoingStreams.map((s) => {
                const flow = s.stream ? formatFlowRate(s.stream.flowRate) : null
                const deposit = s.stream?.deposit.amount ?? '0'
                const cd = depositCountdown(s, now)
                const cancellable = s.stream?.cancellable ?? true
                const denomLabel = s.denom === 'nund' ? 'FUND' : s.denom
                return (
                  <li
                    key={`${s.receiver}-${s.denom}`}
                    className="flex flex-col gap-1 rounded border border-border p-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex flex-col min-w-0">
                        <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.06em]">
                          <Trans>To</Trans>
                        </span>
                        <span className="font-mono text-[11px] truncate" title={s.receiver}>
                          {s.receiver}
                        </span>
                      </span>
                      <span className="flex flex-col items-end tabular-nums">
                        <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.06em]">
                          <Trans>Deposit</Trans>
                        </span>
                        <span className="font-mono font-medium">
                          {nundToFund(deposit)} {denomLabel}
                        </span>
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground font-mono">
                      <span title={t`Flow rate`}>
                        {flow ? `${flow.amountFund} / ${flow.period}` : '—'}
                      </span>
                      <span
                        className={cd.drained ? 'text-destructive' : undefined}
                        title={t`Deposit drains`}
                      >
                        {cd.label}
                      </span>
                      {!cancellable && (
                        <span
                          className="px-1 rounded bg-muted text-muted-foreground uppercase tracking-[0.06em] text-[10px]"
                          title={t`Cancellation disabled (eFUND-backed stream)`}
                        >
                          <Trans>non-cancel</Trans>
                        </span>
                      )}
                    </div>
                    <div className="flex gap-1 flex-wrap justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 px-2 text-[11px]"
                        onClick={() => setTopUpTarget(s)}
                      >
                        <Trans>Top up</Trans>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 px-2 text-[11px]"
                        onClick={() => setUpdateTarget(s)}
                      >
                        <Trans>Update</Trans>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 px-2 text-[11px]"
                        disabled={!cancellable}
                        onClick={() => setCancelTarget(s)}
                        title={
                          !cancellable
                            ? t`Stream is non-cancellable (eFUND-backed).`
                            : undefined
                        }
                      >
                        <Trans>Cancel</Trans>
                      </Button>
                    </div>
                  </li>
                )
              })}
            </ul>
          </CardContent>
        </Card>
      </div>

      <CreateStreamModal open={createOpen} onOpenChange={setCreateOpen} />

      <ClaimStreamModal
        open={claimTarget !== null}
        onOpenChange={(next) => {
          if (!next) setClaimTarget(null)
        }}
        source={claimTarget?.source ?? null}
        claimableNund={claimTarget?.claimableNund ?? '0'}
      />

      <TopUpStreamModal
        open={topUpTarget !== null}
        onOpenChange={(next) => {
          if (!next) setTopUpTarget(null)
        }}
        source={topUpTarget}
      />

      <UpdateFlowRateModal
        open={updateTarget !== null}
        onOpenChange={(next) => {
          if (!next) setUpdateTarget(null)
        }}
        source={updateTarget}
      />

      <CancelStreamModal
        open={cancelTarget !== null}
        onOpenChange={(next) => {
          if (!next) setCancelTarget(null)
        }}
        source={cancelTarget}
      />
    </>
  )
}
