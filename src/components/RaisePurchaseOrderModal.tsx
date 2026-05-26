import { Trans, useLingui } from '@lingui/react/macro'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'

import { TxModal } from '@/components/TxModal'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  buildMsgUndPurchaseOrder,
  type RaisePurchaseOrderFormValues,
} from '@/lib/msgs/enterprise'
import { useActiveSigner } from '@/lib/signer'

// Gas budget for `MsgUndPurchaseOrder` — lightweight (single keeper write,
// minted Coin construction). 200k matches the staking flow.
const DEFAULT_ENTERPRISE_FEE = {
  amount: [{ denom: 'nund', amount: '20000000' }],
  gas: '200000',
}

interface RaisePurchaseOrderModalProps {
  open: boolean
  onOpenChange: (next: boolean) => void
}

/**
 * Raise an enterprise purchase order — the wallet-side flow for whitelisted
 * accounts. Memo doubles as "proof of purchase" per v1 convention; chain
 * enforces a 100-char cap which we mirror in the form schema.
 */
export function RaisePurchaseOrderModal({
  open,
  onOpenChange,
}: RaisePurchaseOrderModalProps) {
  const { address } = useActiveSigner()
  const { t } = useLingui()

  const form = useForm<RaisePurchaseOrderFormValues>({
    defaultValues: { purchaser: address ?? '', amountFund: '', memo: '' },
  })

  // Reset form when modal opens — clears stale state from a previous submit
  // and refreshes the purchaser field if the active account changed.
  useEffect(() => {
    if (open) form.reset({ purchaser: address ?? '', amountFund: '', memo: '' })
  }, [open, address, form])

  const watched = form.watch()
  const amountValid =
    /^\d+(\.\d+)?$/.test(watched.amountFund) && Number(watched.amountFund) > 0
  const memoValid = (watched.memo ?? '').length <= 100
  const canSubmit = !!address && amountValid && memoValid

  return (
    <TxModal
      open={open}
      onOpenChange={onOpenChange}
      title={<Trans>Raise purchase order</Trans>}
      description={
        <Trans>
          Submit a PO for the enterprise admin to process. On acceptance the
          chain mints the equivalent in eFUND into your enterprise account —
          locked-balance that can pay chain fees but cannot be transferred.
        </Trans>
      }
      formBody={
        <div className="flex flex-col gap-3 text-sm">
          <div className="flex flex-col gap-1">
            <Label htmlFor="raise-po-amount">
              <Trans>Amount (FUND)</Trans>
            </Label>
            <Input
              id="raise-po-amount"
              {...form.register('amountFund')}
              placeholder="100"
              className="font-mono"
            />
            {watched.amountFund !== '' && !amountValid && (
              <span className="text-xs text-destructive">
                <Trans>Amount must be a positive number.</Trans>
              </span>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor="raise-po-memo">
              <Trans>Proof of purchase / memo (max 100 chars)</Trans>
            </Label>
            <Input
              id="raise-po-memo"
              {...form.register('memo')}
              maxLength={100}
              placeholder={t`Invoice #12345 — server costs`}
            />
            <span className="text-[10px] text-muted-foreground font-mono">
              <Trans>
                {(watched.memo ?? '').length} / 100
              </Trans>
            </span>
          </div>
        </div>
      }
      canSubmit={canSubmit}
      buildMsgs={() => {
        if (!address) return []
        return [
          buildMsgUndPurchaseOrder({
            purchaser: address,
            amountFund: watched.amountFund,
          }),
        ]
      }}
      fee={DEFAULT_ENTERPRISE_FEE}
      {...(watched.memo ? { memo: watched.memo } : {})}
      invalidateQueryKeys={[
        ['enterprise', 'orders'],
        ['enterprise', 'locked'],
        ['balance'],
      ]}
      confirmLabel={t`Raise PO`}
    />
  )
}
