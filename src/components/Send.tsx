import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useBalance } from '@/lib/balance'
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
      <section className="border rounded p-3 text-sm text-gray-500">
        Unlock the vault and select an account to send.
      </section>
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
    <section className="border rounded p-3 flex flex-col gap-3">
      <header className="flex items-center justify-between">
        <h2 className="text-sm font-medium">Send</h2>
        {balance.data && (
          <span className="text-xs text-gray-500">
            Balance: <span className="font-mono">{formatNund(balance.data.amount)}</span>{' '}
            FUND
          </span>
        )}
      </header>

      {/* eslint-disable-next-line @typescript-eslint/no-misused-promises */}
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-2 text-sm">
        <label className="flex flex-col gap-1">
          <span className="text-gray-500">Recipient</span>
          <input
            {...form.register('recipient')}
            placeholder="und1…"
            className="border rounded px-2 py-1 font-mono text-xs"
          />
          {form.formState.errors.recipient && (
            <span className="text-xs text-red-600">{form.formState.errors.recipient.message}</span>
          )}
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-gray-500">Amount (FUND)</span>
          <input
            {...form.register('amountFund')}
            placeholder="0.001"
            className="border rounded px-2 py-1 font-mono"
          />
          {form.formState.errors.amountFund && (
            <span className="text-xs text-red-600">
              {form.formState.errors.amountFund.message}
            </span>
          )}
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-gray-500">Memo (optional)</span>
          <input
            {...form.register('memo')}
            maxLength={256}
            className="border rounded px-2 py-1"
          />
        </label>

        <button
          type="submit"
          className="bg-blue-600 text-white rounded py-1 text-sm hover:bg-blue-700"
        >
          Continue
        </button>
      </form>

      <Dialog
        open={pendingValues !== null}
        onOpenChange={(next) => {
          if (!next) cancelConfirm()
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm send</DialogTitle>
            <DialogDescription>
              Review the details below. Once confirmed the Tx broadcasts immediately and
              cannot be cancelled.
            </DialogDescription>
          </DialogHeader>
          {pendingValues && (
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
              <dt className="text-muted-foreground">To</dt>
              <dd className="font-mono break-all">{pendingValues.recipient}</dd>
              <dt className="text-muted-foreground">Amount</dt>
              <dd className="font-mono">
                {pendingValues.amountFund} FUND ({fundToNund(pendingValues.amountFund)} nund)
              </dd>
              {pendingValues.memo && (
                <>
                  <dt className="text-muted-foreground">Memo</dt>
                  <dd className="break-words">{pendingValues.memo}</dd>
                </>
              )}
              <dt className="text-muted-foreground">Fee</dt>
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
              Back
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={submitting}
              // eslint-disable-next-line @typescript-eslint/no-misused-promises
              onClick={onConfirm}
            >
              {submitting ? 'Broadcasting…' : 'Confirm + send'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {error && !pendingValues && (
        <p className="text-xs text-red-600 break-words">{error.message}</p>
      )}
      {txHash && (
        <p className="text-xs text-green-700 break-all">
          Sent! Tx: <span className="font-mono">{txHash}</span>
        </p>
      )}
    </section>
  )
}
