import { zodResolver } from '@hookform/resolvers/zod'
import { Trans, useLingui } from '@lingui/react/macro'
import { AlertTriangle } from 'lucide-react'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'

import { TxModal } from '@/components/TxModal'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useBalance } from '@/lib/balance'
import { fundToNund } from '@/lib/msgs/send'
import {
  buildMsgDelegate,
  DelegateFormSchema,
  DEFAULT_STAKING_FEE,
  RECOMMENDED_MIN_BALANCE_NUND,
  type DelegateFormValues,
} from '@/lib/msgs/staking'
import { useActiveSigner } from '@/lib/signer'
import type { Validator } from '@/lib/staking'

interface DelegateModalProps {
  open: boolean
  onOpenChange: (next: boolean) => void
  /** Validator the user is delegating to. Pre-fills the address field. */
  validator: Validator | null
}

/**
 * Delegate-to-validator flow. Form body lives here; submission shell + Tx
 * lifecycle come from `<TxModal />`. The same pattern repeats for M2.3's
 * undelegate / redelegate / withdraw-rewards flows (different form body,
 * different `buildMsgs`, identical wrapper).
 */
export function DelegateModal({ open, onOpenChange, validator }: DelegateModalProps) {
  const { address } = useActiveSigner()
  const balance = useBalance(address, 'nund')
  const { t } = useLingui()

  const form = useForm<DelegateFormValues>({
    resolver: zodResolver(DelegateFormSchema),
    defaultValues: {
      validatorAddress: validator?.operatorAddress ?? '',
      amountFund: '',
      denom: 'nund',
      memo: '',
    },
  })

  // Reset form when validator changes — open a fresh modal targeting a
  // different validator should not reuse the previous amount.
  useEffect(() => {
    if (open && validator) {
      form.reset({
        validatorAddress: validator.operatorAddress,
        amountFund: '',
        denom: 'nund',
        memo: '',
      })
    }
  }, [open, validator, form])

  const watched = form.watch()
  const amountValid = /^\d+(\.\d+)?$/.test(watched.amountFund) && Number(watched.amountFund) > 0
  const formValid = form.formState.isValid && amountValid && !!address

  // Compute post-delegate balance projection + minimum-recommended-balance
  // warning. Non-blocking — the user can still proceed; they just see the
  // warning surface.
  const postBalanceWarning = (() => {
    if (!balance.data || !amountValid) return null
    try {
      const balanceNund = BigInt(balance.data.amount)
      const amountNund = BigInt(fundToNund(watched.amountFund))
      const feeNund = BigInt(DEFAULT_STAKING_FEE.amount[0]?.amount ?? '0')
      const postNund = balanceNund - amountNund - feeNund
      if (postNund < 0n) return 'insufficient'
      if (postNund < RECOMMENDED_MIN_BALANCE_NUND) return 'below-recommended'
      return null
    } catch {
      return null
    }
  })()

  const canSubmit = formValid && postBalanceWarning !== 'insufficient'

  const buildMsgs = () => {
    if (!address) return []
    return [
      buildMsgDelegate({
        delegatorAddress: address,
        validatorAddress: watched.validatorAddress,
        amountFund: watched.amountFund,
        denom: watched.denom,
      }),
    ]
  }

  const moniker = validator?.description?.moniker ?? validator?.operatorAddress ?? ''

  return (
    <TxModal
      open={open}
      onOpenChange={onOpenChange}
      title={<Trans>Delegate to {moniker}</Trans>}
      description={
        <Trans>
          Delegate FUND to this validator. Rewards accrue automatically; undelegating
          starts an unbonding period defined by the chain&apos;s staking params.
        </Trans>
      }
      formBody={
        <div className="flex flex-col gap-3 text-sm">
          <div className="flex flex-col gap-1">
            <Label htmlFor="delegate-validator">
              <Trans>Validator</Trans>
            </Label>
            <Input
              id="delegate-validator"
              {...form.register('validatorAddress')}
              readOnly
              className="font-mono text-xs"
            />
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor="delegate-amount">
              <Trans>Amount (FUND)</Trans>
            </Label>
            <Input
              id="delegate-amount"
              {...form.register('amountFund')}
              placeholder="0.001"
              className="font-mono"
            />
            {balance.data && (
              <span className="text-[11px] text-muted-foreground">
                <Trans>
                  Balance: <span className="font-mono">{formatNundDisplay(balance.data.amount)}</span> FUND
                </Trans>
              </span>
            )}
            {form.formState.errors.amountFund && (
              <span className="text-xs text-destructive">
                {form.formState.errors.amountFund.message}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor="delegate-memo">
              <Trans>Memo (optional)</Trans>
            </Label>
            <Input
              id="delegate-memo"
              {...form.register('memo')}
              maxLength={256}
            />
          </div>

          {postBalanceWarning === 'insufficient' && (
            <p className="text-xs text-destructive flex items-start gap-1">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-none" />
              <span>
                <Trans>Insufficient balance — delegate would exceed available funds plus fee.</Trans>
              </span>
            </p>
          )}
          {postBalanceWarning === 'below-recommended' && (
            <p className="text-xs text-amber-600 flex items-start gap-1">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-none" />
              <span>
                <Trans>
                  Post-delegate balance will be below 0.06 FUND. Leave some FUND behind to
                  cover future gas (claiming rewards, undelegating, etc.).
                </Trans>
              </span>
            </p>
          )}
        </div>
      }
      canSubmit={canSubmit}
      buildMsgs={buildMsgs}
      fee={DEFAULT_STAKING_FEE}
      {...(watched.memo ? { memo: watched.memo } : {})}
      invalidateQueryKeys={[
        ['staking', 'delegations'],
        ['staking', 'validators'],
      ]}
      confirmLabel={t`Delegate`}
      onSuccess={() => {
        form.reset({
          validatorAddress: validator?.operatorAddress ?? '',
          amountFund: '',
          denom: 'nund',
          memo: '',
        })
      }}
    />
  )
}

function formatNundDisplay(amount: string): string {
  try {
    const big = BigInt(amount)
    const nund = 1_000_000_000n
    const whole = big / nund
    const frac = (big % nund).toString().padStart(9, '0').replace(/0+$/, '')
    return frac ? `${whole.toString()}.${frac}` : whole.toString()
  } catch {
    return '0'
  }
}
