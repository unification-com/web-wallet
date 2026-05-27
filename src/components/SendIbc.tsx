import { zodResolver } from '@hookform/resolvers/zod'
import { Trans, useLingui } from '@lingui/react/macro'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  displayDenom,
  formatCoinAmount,
  useAllBalances,
  userAmountToChain,
} from '@/lib/balance'
import { txExplorerUrl, useActiveEndpoint } from '@/lib/chain'
import { useChainByChainId, useCosmosRegistryStore } from '@/lib/cosmosRegistry'
import { useIbcChannels } from '@/lib/ibc'
import {
  buildMsgTransfer,
  defaultTimeoutTimestampNs,
  SendIbcFormSchema,
  type SendIbcFormValues,
} from '@/lib/msgs/ibc'
import { useActiveSigner } from '@/lib/signer'
import { useSubmitTx } from '@/lib/useSubmitTx'

// IBC `MsgTransfer` is structurally light — same gas budget as a bank send.
const DEFAULT_IBC_FEE = {
  amount: [{ denom: 'nund', amount: '20000000' }],
  gas: '200000',
}

/**
 * Send a token over IBC to a connected counterparty chain. Destination
 * chains are discovered via `useIbcChannels` (queries the chain's open
 * transfer channels at runtime — no hardcoded chain list).
 *
 * Surface lives next to `<Send>` in the Wallet view rather than as a top-
 * nav tab; cross-chain transfer is "a kind of send", and grouping them
 * keeps the IA tight.
 */
export function SendIbc() {
  const { address } = useActiveSigner()
  const { data: balances } = useAllBalances(address)
  const { data: channels, isLoading: channelsLoading, error: channelsError } = useIbcChannels()
  const endpoint = useActiveEndpoint()
  const { submit, submitting, error, txHash, reset } = useSubmitTx()
  const queryClient = useQueryClient()
  const { t } = useLingui()
  const [pendingValues, setPendingValues] = useState<SendIbcFormValues | null>(null)

  const form = useForm<SendIbcFormValues>({
    resolver: zodResolver(SendIbcFormSchema),
    defaultValues: {
      sourceChannel: '',
      receiver: '',
      amountFund: '',
      denom: 'nund',
      memo: '',
    },
  })

  // Auto-select the first available channel once discovery resolves —
  // saves the user a click when there's only one destination, and gives
  // a sensible default when there are several.
  useEffect(() => {
    if (channels && channels.length > 0 && !form.getValues('sourceChannel')) {
      form.setValue('sourceChannel', channels[0]?.channelId ?? '')
    }
  }, [channels, form])

  const selectedDenom = form.watch('denom')
  const selectedBalance = balances?.find((c) => c.denom === selectedDenom)
  const selectedChannel = form.watch('sourceChannel')
  const selectedChannelInfo = channels?.find((c) => c.channelId === selectedChannel)
  const watchedReceiver = form.watch('receiver')

  // Pull the destination chain's bech32 prefix from the cosmos registry to
  // do client-side prefix validation. Skips when registry data hasn't
  // landed yet (degrades to the loose any-prefix bech32 validator in the
  // form schema). MUST be called before any early return for rules-of-hooks.
  const destinationChain = useChainByChainId(
    selectedChannelInfo?.counterpartyChainId,
  )
  // Full chain-id → entry map for the dropdown's per-option label
  // enrichment. Read once at render top so the .map() iteration below can
  // do non-hook lookups (per rules-of-hooks: no hooks inside loops with
  // variable item counts).
  const chainsByChainId = useCosmosRegistryStore((s) => s.chainsByChainId)

  if (!address) return null


  const expectedPrefix = destinationChain?.bech32_prefix
  // eslint-disable-next-line @typescript-eslint/prefer-regexp-exec
  const prefixMatch = watchedReceiver.match(/^([a-z][a-z0-9]+)1[a-z0-9]+$/)
  const receiverPrefix = prefixMatch?.[1] ?? null
  const prefixMismatch =
    expectedPrefix &&
    receiverPrefix &&
    receiverPrefix !== expectedPrefix

  const onSubmit = (values: SendIbcFormValues) => {
    setPendingValues(values)
  }

  const onConfirm = async () => {
    if (!pendingValues) return
    try {
      await submit({
        msgs: [
          buildMsgTransfer({
            sender: address,
            receiver: pendingValues.receiver,
            sourceChannel: pendingValues.sourceChannel,
            amountChainSide: userAmountToChain(
              pendingValues.amountFund,
              pendingValues.denom,
            ),
            denom: pendingValues.denom,
            timeoutTimestampNs: defaultTimeoutTimestampNs(),
            ...(pendingValues.memo ? { memo: pendingValues.memo } : {}),
          }),
        ],
        fee: DEFAULT_IBC_FEE,
        ...(pendingValues.memo ? { memo: pendingValues.memo } : {}),
      })
      form.reset({
        sourceChannel: pendingValues.sourceChannel,
        receiver: '',
        amountFund: '',
        denom: pendingValues.denom,
        memo: '',
      })
      setPendingValues(null)
      await queryClient.invalidateQueries({ queryKey: ['balance'] })
    } catch {
      // surfaced via useSubmitTx state below
    }
  }

  const cancelConfirm = () => {
    if (submitting) return
    setPendingValues(null)
    reset()
  }

  const showDenomSelector = (balances?.length ?? 0) > 1
  const noChannels = !channelsLoading && (channels?.length ?? 0) === 0

  return (
    <Card>
      <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0 gap-2">
        <CardTitle className="text-sm">
          <Trans>Send via IBC</Trans>
        </CardTitle>
        {selectedBalance && (
          <span className="text-xs text-muted-foreground">
            <Trans>
              Balance:{' '}
              <span className="font-mono">
                {formatCoinAmount(selectedBalance.amount, selectedBalance.denom)}
              </span>{' '}
              {displayDenom(selectedBalance.denom)}
            </Trans>
          </span>
        )}
      </CardHeader>
      <CardContent className="p-4 pt-2 flex flex-col gap-3">
        <p className="text-[11px] text-muted-foreground">
          <Trans>
            Send a token to an IBC-connected chain. The destination list is
            discovered from this chain&apos;s open IBC channels at runtime —
            no hardcoded chain list, no third-party services.
          </Trans>
        </p>

        {channelsError && (
          <div className="text-xs text-destructive rounded border border-destructive/30 bg-destructive/5 p-2">
            <Trans>Failed to discover IBC channels — try refreshing.</Trans>
          </div>
        )}

        {noChannels && !channelsError && (
          <div className="text-xs text-muted-foreground italic rounded border border-border bg-muted/30 p-2">
            <Trans>
              No open IBC channels found on this network. IBC transfer is
              unavailable.
            </Trans>
          </div>
        )}

        {/* eslint-disable-next-line @typescript-eslint/no-misused-promises */}
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-3 text-sm">
          <div className="flex flex-col gap-1">
            <Label htmlFor="ibc-channel">
              <Trans>Destination chain</Trans>
            </Label>
            <select
              id="ibc-channel"
              {...form.register('sourceChannel')}
              disabled={channelsLoading || noChannels}
              className="h-9 rounded-md border border-input bg-background px-2 text-xs"
            >
              {channelsLoading && <option value="">{t`Loading channels…`}</option>}
              {!channelsLoading &&
                (channels ?? []).map((c) => {
                  const entry = chainsByChainId.get(c.counterpartyChainId)
                  const label = entry?.pretty_name ?? c.counterpartyChainId
                  return (
                    <option key={c.channelId} value={c.channelId}>
                      {label} (via {c.channelId})
                    </option>
                  )
                })}
            </select>
            {form.formState.errors.sourceChannel && (
              <span className="text-xs text-destructive">
                {form.formState.errors.sourceChannel.message}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor="ibc-recipient">
              <Trans>Recipient address (destination chain)</Trans>
            </Label>
            <Input
              id="ibc-recipient"
              {...form.register('receiver')}
              placeholder={t`osmo1… / cosmos1… / …`}
              className="font-mono text-xs"
            />
            {form.formState.errors.receiver && (
              <span className="text-xs text-destructive">
                {form.formState.errors.receiver.message}
              </span>
            )}
            {selectedChannelInfo && (
              <span className="text-[10px] text-muted-foreground">
                {expectedPrefix ? (
                  <Trans>
                    Use a <span className="font-mono">{expectedPrefix}1…</span>{' '}
                    address (
                    {destinationChain?.pretty_name ??
                      selectedChannelInfo.counterpartyChainId}
                    ).
                  </Trans>
                ) : (
                  <Trans>
                    Use a bech32 address valid on{' '}
                    <span className="font-mono">{selectedChannelInfo.counterpartyChainId}</span>.
                    Wrong-prefix addresses are rejected on broadcast.
                  </Trans>
                )}
              </span>
            )}
            {prefixMismatch && (
              <span className="text-xs text-destructive">
                <Trans>
                  Address prefix <span className="font-mono">{receiverPrefix}1…</span>{' '}
                  doesn&apos;t match destination chain{' '}
                  <span className="font-mono">{expectedPrefix}1…</span>. The
                  packet would land somewhere unintended.
                </Trans>
              </span>
            )}
          </div>

          {showDenomSelector && (
            <div className="flex flex-col gap-1">
              <Label htmlFor="ibc-denom">
                <Trans>Denom</Trans>
              </Label>
              <select
                id="ibc-denom"
                {...form.register('denom')}
                className="h-9 rounded-md border border-input bg-background px-2 text-xs"
              >
                {(balances ?? []).map((c) => (
                  <option key={c.denom} value={c.denom}>
                    {displayDenom(c.denom)} — {formatCoinAmount(c.amount, c.denom)}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex flex-col gap-1">
            <Label htmlFor="ibc-amount">
              <Trans>Amount ({displayDenom(selectedDenom)})</Trans>
            </Label>
            <Input
              id="ibc-amount"
              {...form.register('amountFund')}
              placeholder="0.001"
              className="font-mono"
            />
            {form.formState.errors.amountFund && (
              <span className="text-xs text-destructive">
                {form.formState.errors.amountFund.message}
              </span>
            )}
            {selectedDenom !== 'nund' && (
              <span className="text-[10px] text-muted-foreground">
                <Trans>
                  IBC-wrapped denoms are sent in raw chain-side integer units
                  (no FUND-style decimal scaling) until denom-trace metadata
                  lands a future polish.
                </Trans>
              </span>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor="ibc-memo">
              <Trans>Memo (optional)</Trans>
            </Label>
            <Input id="ibc-memo" {...form.register('memo')} maxLength={256} />
          </div>

          <Button
            type="submit"
            size="sm"
            disabled={noChannels || Boolean(prefixMismatch)}
          >
            <Trans>Continue</Trans>
          </Button>
        </form>

        <Dialog
          open={pendingValues !== null}
          onOpenChange={(next) => {
            if (!next) cancelConfirm()
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                <Trans>Confirm IBC transfer</Trans>
              </DialogTitle>
              <DialogDescription>
                <Trans>
                  This sends a token across IBC. The Tx lands on this chain
                  immediately; the relay packet typically arrives at the
                  destination within seconds-to-minutes. If no relayer picks
                  it up before the timeout, the funds refund automatically.
                </Trans>
              </DialogDescription>
            </DialogHeader>
            {pendingValues && (
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                <dt className="text-muted-foreground">
                  <Trans>Destination</Trans>
                </dt>
                <dd className="font-mono">
                  {selectedChannelInfo?.counterpartyChainId ?? '—'} (via{' '}
                  {pendingValues.sourceChannel})
                </dd>
                <dt className="text-muted-foreground">
                  <Trans>Recipient</Trans>
                </dt>
                <dd className="font-mono break-all">{pendingValues.receiver}</dd>
                <dt className="text-muted-foreground">
                  <Trans>Amount</Trans>
                </dt>
                <dd className="font-mono">
                  {pendingValues.amountFund} {displayDenom(pendingValues.denom)}
                </dd>
                {pendingValues.memo && (
                  <>
                    <dt className="text-muted-foreground">
                      <Trans>Memo</Trans>
                    </dt>
                    <dd className="break-all">{pendingValues.memo}</dd>
                  </>
                )}
              </dl>
            )}
            {error && (
              <p className="text-xs text-destructive break-words">{error.message}</p>
            )}
            {txHash && (
              <p className="text-xs text-success break-all">
                <Trans>
                  Submitted! Tx:{' '}
                  {endpoint.txExplorerBase ? (
                    <a
                      href={txExplorerUrl(endpoint, txHash) ?? '#'}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="font-mono underline-offset-2 hover:underline"
                    >
                      {txHash}
                    </a>
                  ) : (
                    <span className="font-mono">{txHash}</span>
                  )}
                </Trans>
              </p>
            )}
            <DialogFooter className="gap-2">
              {txHash ? (
                <Button type="button" size="sm" onClick={cancelConfirm}>
                  <Trans>Close</Trans>
                </Button>
              ) : (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={submitting}
                    onClick={cancelConfirm}
                  >
                    <Trans>Cancel</Trans>
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={submitting}
                    // eslint-disable-next-line @typescript-eslint/no-misused-promises
                    onClick={onConfirm}
                  >
                    {submitting ? <Trans>Broadcasting…</Trans> : <Trans>Confirm transfer</Trans>}
                  </Button>
                </>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}
