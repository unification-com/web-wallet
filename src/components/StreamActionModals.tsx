import { Trans, useLingui } from '@lingui/react/macro'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'

import { TxModal } from '@/components/TxModal'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { fundToNund, nundToFund } from '@/lib/msgs/send'
import {
  buildMsgCancelStream,
  buildMsgClaimStream,
  buildMsgCreateStream,
  buildMsgTopUpDeposit,
  buildMsgUpdateFlowRate,
} from '@/lib/msgs/stream'
import { useActiveSigner } from '@/lib/signer'
import { SECONDS_PER_PERIOD, type StreamResult } from '@/lib/stream'

// ---------------------------------------------------------------------------
// Shared defaults
// ---------------------------------------------------------------------------

// All five stream Msgs are similarly sized; use one fee constant across the
// modal set. Gas of 200k matches a single bank send envelope (the on-chain
// stream module is light — minimal storage writes per Msg).
const DEFAULT_STREAM_FEE = {
  amount: [{ denom: 'nund', amount: '20000000' }],
  gas: '200000',
}

// Lingui-untracked period labels: small enough that an inline tuple keeps the
// markup readable. Each form below renders its own `<select>` over this set.
const PERIODS: readonly { value: keyof typeof SECONDS_PER_PERIOD; label: string }[] = [
  { value: 'sec', label: 'per second' },
  { value: 'min', label: 'per minute' },
  { value: 'hour', label: 'per hour' },
  { value: 'day', label: 'per day' },
  { value: 'month', label: 'per month (30d)' },
]

/**
 * Pure converter: FUND-per-period → nund-per-second (chain wire format). Used
 * by every modal whose form has a flow-rate slider. Rounds down via BigInt
 * integer divide — the chain truncates fractional rates anyway.
 */
function flowRateNundPerSec(
  amountFund: string,
  period: keyof typeof SECONDS_PER_PERIOD,
): string {
  try {
    const perPeriodNund = BigInt(fundToNund(amountFund))
    const perSec = perPeriodNund / SECONDS_PER_PERIOD[period]
    return perSec.toString()
  } catch {
    return '0'
  }
}

// ---------------------------------------------------------------------------
// Create stream
// ---------------------------------------------------------------------------

interface CreateStreamModalProps {
  open: boolean
  onOpenChange: (next: boolean) => void
}

interface CreateFormValues {
  receiver: string
  depositFund: string
  amountFund: string
  period: keyof typeof SECONDS_PER_PERIOD
  denom: string
  memo: string
}

export function CreateStreamModal({ open, onOpenChange }: CreateStreamModalProps) {
  const { address } = useActiveSigner()
  const { t } = useLingui()
  const form = useForm<CreateFormValues>({
    defaultValues: {
      receiver: '',
      depositFund: '',
      amountFund: '',
      period: 'day',
      denom: 'nund',
      memo: '',
    },
  })

  useEffect(() => {
    if (open) form.reset()
  }, [open, form])

  const watched = form.watch()
  const receiverOk = /^und1[a-z0-9]{38,58}$/.test(watched.receiver)
  const depositOk =
    /^\d+(\.\d+)?$/.test(watched.depositFund) && Number(watched.depositFund) > 0
  const amountOk =
    /^\d+(\.\d+)?$/.test(watched.amountFund) && Number(watched.amountFund) > 0
  const flowRate = amountOk ? flowRateNundPerSec(watched.amountFund, watched.period) : '0'
  const flowRateOk = BigInt(flowRate) > 0n
  const canSubmit = !!address && receiverOk && depositOk && amountOk && flowRateOk

  return (
    <TxModal
      open={open}
      onOpenChange={onOpenChange}
      title={<Trans>Create stream</Trans>}
      description={
        <Trans>
          Continuously pay the recipient at a chosen rate. The recipient claims
          accrued amounts whenever they want; you can top up the deposit, change
          the rate, or cancel at any time (unless the stream is non-cancellable).
        </Trans>
      }
      formBody={
        <div className="flex flex-col gap-3 text-sm">
          <div className="flex flex-col gap-1">
            <Label htmlFor="create-stream-receiver">
              <Trans>Recipient address</Trans>
            </Label>
            <Input
              id="create-stream-receiver"
              {...form.register('receiver')}
              placeholder="und1…"
              className="font-mono text-xs"
            />
            {watched.receiver !== '' && !receiverOk && (
              <span className="text-xs text-destructive">
                <Trans>Must be a valid und1… address.</Trans>
              </span>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor="create-stream-deposit">
              <Trans>Initial deposit (FUND)</Trans>
            </Label>
            <Input
              id="create-stream-deposit"
              {...form.register('depositFund')}
              placeholder="100"
              className="font-mono"
            />
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor="create-stream-amount">
              <Trans>Flow rate</Trans>
            </Label>
            <div className="flex gap-1">
              <Input
                id="create-stream-amount"
                {...form.register('amountFund')}
                placeholder="1"
                className="font-mono flex-1"
              />
              <select
                id="create-stream-period"
                {...form.register('period')}
                className="h-9 rounded-md border border-input bg-background px-2 text-xs"
              >
                {PERIODS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            {flowRateOk && (
              <span className="text-[11px] text-muted-foreground font-mono">
                <Trans>
                  ≈ {flowRate} nund/sec
                </Trans>
              </span>
            )}
            {watched.amountFund !== '' && !flowRateOk && (
              <span className="text-xs text-destructive">
                <Trans>
                  Flow rate must be ≥ 1 nund/second. Try a larger amount or a
                  shorter period.
                </Trans>
              </span>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor="create-stream-memo">
              <Trans>Memo (optional)</Trans>
            </Label>
            <Input id="create-stream-memo" {...form.register('memo')} maxLength={256} />
          </div>
        </div>
      }
      canSubmit={canSubmit}
      buildMsgs={() => {
        if (!address) return []
        return [
          buildMsgCreateStream({
            sender: address,
            receiver: watched.receiver,
            depositFund: watched.depositFund,
            denom: watched.denom,
            flowRateNundPerSec: flowRate,
          }),
        ]
      }}
      fee={DEFAULT_STREAM_FEE}
      {...(watched.memo ? { memo: watched.memo } : {})}
      invalidateQueryKeys={[['stream', 'outgoing']]}
      confirmLabel={t`Create stream`}
    />
  )
}

// ---------------------------------------------------------------------------
// Claim stream (receiver-side, single click)
// ---------------------------------------------------------------------------

interface ClaimStreamModalProps {
  open: boolean
  onOpenChange: (next: boolean) => void
  /** The incoming-stream row that opened the modal. */
  source: StreamResult | null
  /** Claimable-now amount in chain units (nund). */
  claimableNund: string
}

export function ClaimStreamModal({
  open,
  onOpenChange,
  source,
  claimableNund,
}: ClaimStreamModalProps) {
  const { address } = useActiveSigner()
  const { t } = useLingui()
  const canSubmit = !!address && !!source && BigInt(claimableNund) > 0n
  const denomLabel = source?.denom === 'nund' ? 'FUND' : (source?.denom ?? '')

  return (
    <TxModal
      open={open}
      onOpenChange={onOpenChange}
      title={<Trans>Claim stream</Trans>}
      description={
        <Trans>
          Pull the accrued amount from this stream into your wallet. Future
          accrual continues at the same rate until the deposit drains.
        </Trans>
      }
      formBody={
        <div className="flex flex-col gap-2 text-sm">
          <p>
            <Trans>
              Sender:{' '}
              <span className="font-mono text-xs">{source?.sender ?? ''}</span>
            </Trans>
          </p>
          <p>
            <Trans>
              Claimable:{' '}
              <span className="font-mono font-medium">
                {nundToFund(claimableNund)}
              </span>{' '}
              {denomLabel}
            </Trans>
          </p>
        </div>
      }
      canSubmit={canSubmit}
      buildMsgs={() => {
        if (!address || !source) return []
        return [
          buildMsgClaimStream({
            receiver: address,
            sender: source.sender,
            denom: source.denom,
          }),
        ]
      }}
      fee={DEFAULT_STREAM_FEE}
      invalidateQueryKeys={[
        ['stream', 'incoming'],
        ['balance'],
      ]}
      confirmLabel={t`Claim`}
    />
  )
}

// ---------------------------------------------------------------------------
// Top up deposit (sender-side)
// ---------------------------------------------------------------------------

interface TopUpStreamModalProps {
  open: boolean
  onOpenChange: (next: boolean) => void
  /** The outgoing-stream row that opened the modal. */
  source: StreamResult | null
}

interface TopUpFormValues {
  depositFund: string
  memo: string
}

export function TopUpStreamModal({ open, onOpenChange, source }: TopUpStreamModalProps) {
  const { address } = useActiveSigner()
  const { t } = useLingui()

  const form = useForm<TopUpFormValues>({
    defaultValues: { depositFund: '', memo: '' },
  })

  useEffect(() => {
    if (open) form.reset({ depositFund: '', memo: '' })
  }, [open, form])

  const watched = form.watch()
  const amountOk =
    /^\d+(\.\d+)?$/.test(watched.depositFund) && Number(watched.depositFund) > 0
  const canSubmit = !!address && !!source && amountOk

  return (
    <TxModal
      open={open}
      onOpenChange={onOpenChange}
      title={<Trans>Top up stream deposit</Trans>}
      description={
        <Trans>
          Add to the deposit covering this stream. The flow rate is unchanged;
          a larger deposit just pushes the drain date further out.
        </Trans>
      }
      formBody={
        <div className="flex flex-col gap-3 text-sm">
          <p className="text-xs text-muted-foreground">
            <Trans>
              Recipient:{' '}
              <span className="font-mono">{source?.receiver ?? ''}</span>
            </Trans>
          </p>
          <div className="flex flex-col gap-1">
            <Label htmlFor="topup-stream-amount">
              <Trans>Additional deposit (FUND)</Trans>
            </Label>
            <Input
              id="topup-stream-amount"
              {...form.register('depositFund')}
              placeholder="100"
              className="font-mono"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="topup-stream-memo">
              <Trans>Memo (optional)</Trans>
            </Label>
            <Input id="topup-stream-memo" {...form.register('memo')} maxLength={256} />
          </div>
        </div>
      }
      canSubmit={canSubmit}
      buildMsgs={() => {
        if (!address || !source) return []
        return [
          buildMsgTopUpDeposit({
            sender: address,
            receiver: source.receiver,
            depositFund: watched.depositFund,
            denom: source.denom,
          }),
        ]
      }}
      fee={DEFAULT_STREAM_FEE}
      {...(watched.memo ? { memo: watched.memo } : {})}
      invalidateQueryKeys={[['stream', 'outgoing']]}
      confirmLabel={t`Top up`}
    />
  )
}

// ---------------------------------------------------------------------------
// Update flow rate (sender-side)
// ---------------------------------------------------------------------------

interface UpdateFlowRateModalProps {
  open: boolean
  onOpenChange: (next: boolean) => void
  source: StreamResult | null
}

interface UpdateFormValues {
  amountFund: string
  period: keyof typeof SECONDS_PER_PERIOD
  memo: string
}

export function UpdateFlowRateModal({
  open,
  onOpenChange,
  source,
}: UpdateFlowRateModalProps) {
  const { address } = useActiveSigner()
  const { t } = useLingui()

  const form = useForm<UpdateFormValues>({
    defaultValues: { amountFund: '', period: 'day', memo: '' },
  })

  useEffect(() => {
    if (open) form.reset({ amountFund: '', period: 'day', memo: '' })
  }, [open, form])

  const watched = form.watch()
  const amountOk =
    /^\d+(\.\d+)?$/.test(watched.amountFund) && Number(watched.amountFund) > 0
  const flowRate = amountOk ? flowRateNundPerSec(watched.amountFund, watched.period) : '0'
  const flowRateOk = BigInt(flowRate) > 0n
  const canSubmit = !!address && !!source && amountOk && flowRateOk

  return (
    <TxModal
      open={open}
      onOpenChange={onOpenChange}
      title={<Trans>Update flow rate</Trans>}
      description={
        <Trans>
          Change the rate at which this stream pays out. Takes effect from the
          next block — past accrual is unaffected.
        </Trans>
      }
      formBody={
        <div className="flex flex-col gap-3 text-sm">
          <p className="text-xs text-muted-foreground">
            <Trans>
              Recipient:{' '}
              <span className="font-mono">{source?.receiver ?? ''}</span>
            </Trans>
          </p>
          <div className="flex flex-col gap-1">
            <Label htmlFor="update-flow-amount">
              <Trans>New flow rate</Trans>
            </Label>
            <div className="flex gap-1">
              <Input
                id="update-flow-amount"
                {...form.register('amountFund')}
                placeholder="1"
                className="font-mono flex-1"
              />
              <select
                id="update-flow-period"
                {...form.register('period')}
                className="h-9 rounded-md border border-input bg-background px-2 text-xs"
              >
                {PERIODS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            {flowRateOk && (
              <span className="text-[11px] text-muted-foreground font-mono">
                <Trans>
                  ≈ {flowRate} nund/sec
                </Trans>
              </span>
            )}
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="update-flow-memo">
              <Trans>Memo (optional)</Trans>
            </Label>
            <Input id="update-flow-memo" {...form.register('memo')} maxLength={256} />
          </div>
        </div>
      }
      canSubmit={canSubmit}
      buildMsgs={() => {
        if (!address || !source) return []
        return [
          buildMsgUpdateFlowRate({
            sender: address,
            receiver: source.receiver,
            flowRateNundPerSec: flowRate,
            denom: source.denom,
          }),
        ]
      }}
      fee={DEFAULT_STREAM_FEE}
      {...(watched.memo ? { memo: watched.memo } : {})}
      invalidateQueryKeys={[['stream', 'outgoing']]}
      confirmLabel={t`Update`}
    />
  )
}

// ---------------------------------------------------------------------------
// Cancel stream (sender-side, confirmation only)
// ---------------------------------------------------------------------------

interface CancelStreamModalProps {
  open: boolean
  onOpenChange: (next: boolean) => void
  source: StreamResult | null
}

export function CancelStreamModal({ open, onOpenChange, source }: CancelStreamModalProps) {
  const { address } = useActiveSigner()
  const { t } = useLingui()
  const cancellable = source?.stream?.cancellable ?? false
  const denomLabel = source?.denom === 'nund' ? 'FUND' : (source?.denom ?? '')
  const remainingDeposit = source?.stream?.deposit.amount ?? '0'
  const canSubmit = !!address && !!source && cancellable

  return (
    <TxModal
      open={open}
      onOpenChange={onOpenChange}
      title={<Trans>Cancel stream</Trans>}
      description={
        cancellable ? (
          <Trans>
            Cancelling stops further outflow immediately. Any amount the
            recipient has accrued but not yet claimed stays claimable; the
            unclaimed portion of your deposit returns to your wallet.
          </Trans>
        ) : (
          <Trans>
            This stream is non-cancellable (chain-enforced — typically because
            it&apos;s funded by eFUND).
          </Trans>
        )
      }
      formBody={
        <div className="flex flex-col gap-2 text-sm">
          <p>
            <Trans>
              Recipient:{' '}
              <span className="font-mono text-xs">{source?.receiver ?? ''}</span>
            </Trans>
          </p>
          <p>
            <Trans>
              Remaining deposit:{' '}
              <span className="font-mono font-medium">
                {nundToFund(remainingDeposit)}
              </span>{' '}
              {denomLabel}
            </Trans>
          </p>
        </div>
      }
      canSubmit={canSubmit}
      buildMsgs={() => {
        if (!address || !source) return []
        return [
          buildMsgCancelStream({
            sender: address,
            receiver: source.receiver,
            denom: source.denom,
          }),
        ]
      }}
      fee={DEFAULT_STREAM_FEE}
      invalidateQueryKeys={[
        ['stream', 'outgoing'],
        ['balance'],
      ]}
      confirmLabel={t`Cancel stream`}
    />
  )
}
