import { zodResolver } from '@hookform/resolvers/zod'
import { Trans, useLingui } from '@lingui/react/macro'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
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
import { useBalance } from '@/lib/balance'
import { txExplorerUrl, useActiveEndpoint } from '@/lib/chain'
import {
  buildMsgSend,
  fundToNund,
  SendFormSchema,
  type SendFormValues,
} from '@/lib/msgs/send'
import { useActiveSigner } from '@/lib/signer'
import { useSubmitTx } from '@/lib/useSubmitTx'

// Default fee for a bank send Tx. Aligned with v1's `DEFAULT_TRANSFER_FEES`
// (20_000_000 nund / 200_000 gas) — chain-side this is well within the
// minimum-gas-prices floor for `nund`.
const DEFAULT_SEND_FEE = {
  amount: [{ denom: 'nund', amount: '20000000' }],
  gas: '200000',
}

function formatNund(amount: string): string {
  const n = BigInt(amount)
  const nund = 1_000_000_000n
  const whole = n / nund
  const frac = (n % nund).toString().padStart(9, '0').replace(/0+$/, '')
  return frac ? `${whole.toString()}.${frac}` : whole.toString()
}

export function Send() {
  const { address } = useActiveSigner()
  const balance = useBalance(address, 'nund')
  const { submit, submitting, error, txHash, reset } = useSubmitTx()
  const queryClient = useQueryClient()
  const { t } = useLingui()
  const [pendingValues, setPendingValues] = useState<SendFormValues | null>(null)

  const form = useForm<SendFormValues>({
    resolver: zodResolver(SendFormSchema),
    defaultValues: {
      recipient: '',
      amountFund: '',
      denom: 'nund',
      memo: '',
    },
  })

  if (!address) {
    return (
      <Card>
        <CardContent className="p-4 text-sm text-muted-foreground">
          <Trans>Unlock the vault and select an account to send.</Trans>
        </CardContent>
      </Card>
    )
  }

  const onSubmit = (values: SendFormValues) => {
    setPendingValues(values)
  }

  const onConfirm = async () => {
    if (!pendingValues) return
    try {
      await submit({
        msgs: [
          buildMsgSend({
            fromAddress: address,
            toAddress: pendingValues.recipient,
            amountFund: pendingValues.amountFund,
            denom: pendingValues.denom,
          }),
        ],
        fee: DEFAULT_SEND_FEE,
        ...(pendingValues.memo ? { memo: pendingValues.memo } : {}),
      })
      form.reset()
      setPendingValues(null)
      // Instant balance refresh — don't wait for the 8 s poll interval.
      // Sender's balance drops by amount + fee; recipient's balance bumps
      // (if it's our address too, the second invalidation handles it).
      await queryClient.invalidateQueries({ queryKey: ['balance'] })
    } catch {
      // error already captured in useSubmitTx state — surfaced below.
    }
  }

  const cancelConfirm = () => {
    if (submitting) return
    setPendingValues(null)
    reset()
  }

  return (
    <Card>
      <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm">
          <Trans>Send</Trans>
        </CardTitle>
        {balance.data && (
          <span className="text-xs text-muted-foreground">
            <Trans>
              Balance: <span className="font-mono">{formatNund(balance.data.amount)}</span> FUND
            </Trans>
          </span>
        )}
      </CardHeader>
      <CardContent className="p-4 pt-2 flex flex-col gap-3">
        {/* eslint-disable-next-line @typescript-eslint/no-misused-promises */}
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-3 text-sm">
          <div className="flex flex-col gap-1">
            <Label htmlFor="send-recipient">
              <Trans>Recipient</Trans>
            </Label>
            <Input
              id="send-recipient"
              {...form.register('recipient')}
              placeholder={t`und1…`}
              className="font-mono text-xs"
            />
            {form.formState.errors.recipient && (
              <span className="text-xs text-destructive">
                {form.formState.errors.recipient.message}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor="send-amount">
              <Trans>Amount (FUND)</Trans>
            </Label>
            <Input
              id="send-amount"
              {...form.register('amountFund')}
              placeholder="0.001"
              className="font-mono"
            />
            {form.formState.errors.amountFund && (
              <span className="text-xs text-destructive">
                {form.formState.errors.amountFund.message}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor="send-memo">
              <Trans>Memo (optional)</Trans>
            </Label>
            <Input
              id="send-memo"
              {...form.register('memo')}
              maxLength={256}
            />
          </div>

          <Button type="submit" size="sm">
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
              <Trans>Confirm send</Trans>
            </DialogTitle>
            <DialogDescription>
              <Trans>
                Review the details below. Once confirmed the Tx broadcasts immediately and
                cannot be cancelled.
              </Trans>
            </DialogDescription>
          </DialogHeader>
          {pendingValues && (
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
              <dt className="text-muted-foreground">
                <Trans>To</Trans>
              </dt>
              <dd className="font-mono break-all">{pendingValues.recipient}</dd>
              <dt className="text-muted-foreground">
                <Trans>Amount</Trans>
              </dt>
              <dd className="font-mono">
                {pendingValues.amountFund} FUND ({fundToNund(pendingValues.amountFund)} nund)
              </dd>
              {pendingValues.memo && (
                <>
                  <dt className="text-muted-foreground">
                    <Trans>Memo</Trans>
                  </dt>
                  <dd className="break-words">{pendingValues.memo}</dd>
                </>
              )}
              <dt className="text-muted-foreground">
                <Trans>Fee</Trans>
              </dt>
              <dd className="font-mono">20,000,000 nund</dd>
            </dl>
          )}
          {error && (
            <p className="text-xs text-destructive break-words">{error.message}</p>
          )}
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={submitting}
              onClick={cancelConfirm}
            >
              <Trans>Back</Trans>
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={submitting}
              // eslint-disable-next-line @typescript-eslint/no-misused-promises
              onClick={onConfirm}
            >
              {submitting ? <Trans>Broadcasting…</Trans> : <Trans>Confirm + send</Trans>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

        {error && !pendingValues && (
          <p className="text-xs text-destructive break-words">{error.message}</p>
        )}
        {txHash && <SentLine txHash={txHash} />}
      </CardContent>
    </Card>
  )
}

function SentLine({ txHash }: { txHash: string }) {
  const endpoint = useActiveEndpoint()
  const href = txExplorerUrl(endpoint, txHash)
  return (
    <p className="text-xs text-green-700 break-all">
      {href ? (
        <Trans>
          Sent! Tx:{' '}
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono hover:underline"
          >
            {txHash}
          </a>
        </Trans>
      ) : (
        <Trans>
          Sent! Tx: <span className="font-mono">{txHash}</span>
        </Trans>
      )}
    </p>
  )
}
