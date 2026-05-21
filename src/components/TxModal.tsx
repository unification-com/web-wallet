import { type EncodeObject } from '@cosmjs/proto-signing'
import { type StdFee } from '@cosmjs/stargate'
import { Trans } from '@lingui/react/macro'
import { useQueryClient } from '@tanstack/react-query'
import { type ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useSubmitTx } from '@/lib/useSubmitTx'

/**
 * Shared Tx-submission shell. Every staking flow (delegate / undelegate /
 * redelegate / withdraw-rewards) reuses this. The `formBody` slot renders
 * the per-flow form; `buildMsgs` returns the Msgs to broadcast; everything
 * else (submit state, error display, success tx-hash, modal lifecycle,
 * query invalidation) is shared.
 *
 * Design follows the M2.3 spec: `{ title, description, formBody, fee,
 * buildMsgs, onSuccess, canSubmit }` — three M2.3 flows differ only in
 * form fields + Msgs they emit.
 */
export interface TxModalProps {
  open: boolean
  onOpenChange: (next: boolean) => void
  title: ReactNode
  description?: ReactNode
  /** The form fields. Renders inside the dialog body. */
  formBody: ReactNode
  /** Gates the Confirm button (e.g. form valid, amount > 0). */
  canSubmit: boolean
  /** Returns the Msgs to broadcast. Called when Confirm is clicked. */
  buildMsgs: () => readonly EncodeObject[]
  /** Default-fee for the Tx. */
  fee: StdFee | 'auto'
  /** Optional memo on the Tx. */
  memo?: string
  /** Fired after a successful broadcast (e.g. close modal, reset form). */
  onSuccess?: (txHash: string) => void
  /** Query keys to invalidate on success (e.g. ['staking', 'delegations']). */
  invalidateQueryKeys?: readonly (readonly string[])[]
  /** Label for the confirm button (default: "Confirm"). */
  confirmLabel?: ReactNode
}

export function TxModal({
  open,
  onOpenChange,
  title,
  description,
  formBody,
  canSubmit,
  buildMsgs,
  fee,
  memo,
  onSuccess,
  invalidateQueryKeys,
  confirmLabel,
}: TxModalProps) {
  const { submit, submitting, error, txHash, reset } = useSubmitTx()
  const queryClient = useQueryClient()

  const onConfirm = async () => {
    try {
      const result = await submit({
        msgs: buildMsgs(),
        fee,
        ...(memo !== undefined ? { memo } : {}),
      })
      // Invalidate downstream queries so balance / delegations / etc. refresh
      // immediately after broadcast lands.
      if (invalidateQueryKeys) {
        await Promise.all(
          invalidateQueryKeys.map((key) => queryClient.invalidateQueries({ queryKey: [...key] })),
        )
      }
      // Always invalidate balance (every Tx changes it via fee).
      await queryClient.invalidateQueries({ queryKey: ['balance'] })
      onSuccess?.(result.transactionHash)
    } catch {
      // error already captured in useSubmitTx state — surfaced below.
    }
  }

  const onCancel = () => {
    if (submitting) return
    reset()
    onOpenChange(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel()
        else onOpenChange(next)
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="flex flex-col gap-2">{formBody}</div>
        {error && (
          <p className="text-xs text-destructive break-words">{error.message}</p>
        )}
        {txHash && (
          <p className="text-xs text-green-700 break-all">
            <Trans>
              Submitted! Tx: <span className="font-mono">{txHash}</span>
            </Trans>
          </p>
        )}
        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={submitting}
            onClick={onCancel}
          >
            <Trans>Cancel</Trans>
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={!canSubmit || submitting}
            // eslint-disable-next-line @typescript-eslint/no-misused-promises
            onClick={onConfirm}
          >
            {submitting ? (
              <Trans>Broadcasting…</Trans>
            ) : (
              (confirmLabel ?? <Trans>Confirm</Trans>)
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
