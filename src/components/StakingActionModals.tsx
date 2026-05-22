import { zodResolver } from '@hookform/resolvers/zod'
import { Trans, useLingui } from '@lingui/react/macro'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'

import { TxModal } from '@/components/TxModal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { decCoinToFund, nundToFund } from '@/lib/msgs/send'
import {
  buildMsgBeginRedelegate,
  buildMsgUndelegate,
  buildMsgWithdrawDelegatorReward,
  DEFAULT_STAKING_FEE,
  RedelegateFormSchema,
  UndelegateFormSchema,
  type RedelegateFormValues,
  type UndelegateFormValues,
} from '@/lib/msgs/staking'
import { useActiveSigner } from '@/lib/signer'
import { isActiveValidator, useValidators, type Validator } from '@/lib/staking'

// ---------------------------------------------------------------------------
// Undelegate
// ---------------------------------------------------------------------------

interface UndelegateModalProps {
  open: boolean
  onOpenChange: (next: boolean) => void
  /** Validator to undelegate FROM. Drives the form's prefill + display. */
  srcValidator: Validator | null
  /** Current delegation amount in nund — surfaces in the UI as a max hint. */
  currentDelegationNund?: string
}

/**
 * Undelegate from a validator. Starts an unbonding period (~21 days on
 * MainNet, faster on TestNet) before the funds become spendable.
 */
export function UndelegateModal({
  open,
  onOpenChange,
  srcValidator,
  currentDelegationNund,
}: UndelegateModalProps) {
  const { address } = useActiveSigner()
  const { t } = useLingui()

  const form = useForm<UndelegateFormValues>({
    resolver: zodResolver(UndelegateFormSchema),
    defaultValues: {
      validatorAddress: srcValidator?.operatorAddress ?? '',
      amountFund: '',
      denom: 'nund',
      memo: '',
    },
  })

  useEffect(() => {
    if (open && srcValidator) {
      form.reset({
        validatorAddress: srcValidator.operatorAddress,
        amountFund: '',
        denom: 'nund',
        memo: '',
      })
    }
  }, [open, srcValidator, form])

  const watched = form.watch()
  const amountValid =
    /^\d+(\.\d+)?$/.test(watched.amountFund) && Number(watched.amountFund) > 0
  const canSubmit = form.formState.isValid && amountValid && !!address

  const moniker = srcValidator?.description?.moniker ?? srcValidator?.operatorAddress ?? ''

  return (
    <TxModal
      open={open}
      onOpenChange={onOpenChange}
      title={<Trans>Undelegate from {moniker}</Trans>}
      description={
        <Trans>
          Starts a chain-defined unbonding period (typically 21 days on MainNet) before the
          undelegated FUND becomes spendable. During unbonding the amount stops earning
          rewards.
        </Trans>
      }
      formBody={
        <div className="flex flex-col gap-3 text-sm">
          <div className="flex flex-col gap-1">
            <Label htmlFor="undelegate-amount">
              <Trans>Amount to undelegate (FUND)</Trans>
            </Label>
            <div className="flex gap-1">
              <Input
                id="undelegate-amount"
                {...form.register('amountFund')}
                placeholder="0.001"
                className="font-mono"
              />
              {currentDelegationNund && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 px-2 text-[11px] shrink-0"
                  onClick={() => form.setValue('amountFund', nundToFund(currentDelegationNund))}
                  title={t`Fill the amount with your full current delegation`}
                >
                  <Trans>Max</Trans>
                </Button>
              )}
            </div>
            {currentDelegationNund && (
              <span className="text-[11px] text-muted-foreground">
                <Trans>
                  Currently delegated:{' '}
                  <span className="font-mono">{nundToFund(currentDelegationNund)}</span> FUND
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
            <Label htmlFor="undelegate-memo">
              <Trans>Memo (optional)</Trans>
            </Label>
            <Input id="undelegate-memo" {...form.register('memo')} maxLength={256} />
          </div>
        </div>
      }
      canSubmit={canSubmit}
      buildMsgs={() => {
        if (!address) return []
        return [
          buildMsgUndelegate({
            delegatorAddress: address,
            validatorAddress: watched.validatorAddress,
            amountFund: watched.amountFund,
            denom: watched.denom,
          }),
        ]
      }}
      fee={DEFAULT_STAKING_FEE}
      {...(watched.memo ? { memo: watched.memo } : {})}
      invalidateQueryKeys={[
        ['staking', 'delegations'],
        ['staking', 'unbondings'],
        ['staking', 'rewards'],
      ]}
      confirmLabel={t`Undelegate`}
    />
  )
}

// ---------------------------------------------------------------------------
// Redelegate
// ---------------------------------------------------------------------------

interface RedelegateModalProps {
  open: boolean
  onOpenChange: (next: boolean) => void
  srcValidator: Validator | null
  currentDelegationNund?: string
}

/**
 * Redelegate from one validator to another. Chain treats redelegations
 * specially — no unbonding period, but the destination is locked from
 * further redelegation for the unbonding-period window.
 */
export function RedelegateModal({
  open,
  onOpenChange,
  srcValidator,
  currentDelegationNund,
}: RedelegateModalProps) {
  const { address } = useActiveSigner()
  const { t } = useLingui()
  const { data: validators } = useValidators()

  const form = useForm<RedelegateFormValues>({
    resolver: zodResolver(RedelegateFormSchema),
    defaultValues: {
      srcValidatorAddress: srcValidator?.operatorAddress ?? '',
      dstValidatorAddress: '',
      amountFund: '',
      denom: 'nund',
      memo: '',
    },
  })

  useEffect(() => {
    if (open && srcValidator) {
      form.reset({
        srcValidatorAddress: srcValidator.operatorAddress,
        dstValidatorAddress: '',
        amountFund: '',
        denom: 'nund',
        memo: '',
      })
    }
  }, [open, srcValidator, form])

  const watched = form.watch()
  const amountValid =
    /^\d+(\.\d+)?$/.test(watched.amountFund) && Number(watched.amountFund) > 0
  const canSubmit =
    form.formState.isValid &&
    amountValid &&
    !!address &&
    !!watched.dstValidatorAddress &&
    watched.dstValidatorAddress !== watched.srcValidatorAddress

  const srcMoniker =
    srcValidator?.description?.moniker ?? srcValidator?.operatorAddress ?? ''

  // Eligible destinations: active validators OTHER than the source. Sorted
  // by moniker for predictable ordering in the dropdown.
  const dstOptions: Validator[] = (validators ?? [])
    .filter(
      (v) =>
        isActiveValidator(v) && !v.jailed && v.operatorAddress !== srcValidator?.operatorAddress,
    )
    .sort((a, b) =>
      (a.description?.moniker ?? '').localeCompare(b.description?.moniker ?? ''),
    )

  return (
    <TxModal
      open={open}
      onOpenChange={onOpenChange}
      title={<Trans>Redelegate from {srcMoniker}</Trans>}
      description={
        <Trans>
          Redelegate FUND from this validator to another. No unbonding period applies — the
          destination starts earning rewards immediately — but the destination is locked
          from further redelegation until the unbonding-period window passes.
        </Trans>
      }
      formBody={
        <div className="flex flex-col gap-3 text-sm">
          <div className="flex flex-col gap-1">
            <Label htmlFor="redelegate-dst">
              <Trans>Destination validator</Trans>
            </Label>
            <select
              id="redelegate-dst"
              {...form.register('dstValidatorAddress')}
              className="h-9 rounded-md border border-input bg-background px-2 text-xs"
            >
              <option value="">{t`-- pick a destination --`}</option>
              {dstOptions.map((v) => (
                <option key={v.operatorAddress} value={v.operatorAddress}>
                  {v.description?.moniker ?? v.operatorAddress}
                </option>
              ))}
            </select>
            {form.formState.errors.dstValidatorAddress && (
              <span className="text-xs text-destructive">
                {form.formState.errors.dstValidatorAddress.message}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor="redelegate-amount">
              <Trans>Amount to redelegate (FUND)</Trans>
            </Label>
            <Input
              id="redelegate-amount"
              {...form.register('amountFund')}
              placeholder="0.001"
              className="font-mono"
            />
            {currentDelegationNund && (
              <span className="text-[11px] text-muted-foreground">
                <Trans>
                  Currently delegated:{' '}
                  <span className="font-mono">{nundToFund(currentDelegationNund)}</span> FUND
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
            <Label htmlFor="redelegate-memo">
              <Trans>Memo (optional)</Trans>
            </Label>
            <Input id="redelegate-memo" {...form.register('memo')} maxLength={256} />
          </div>
        </div>
      }
      canSubmit={canSubmit}
      buildMsgs={() => {
        if (!address) return []
        return [
          buildMsgBeginRedelegate({
            delegatorAddress: address,
            srcValidatorAddress: watched.srcValidatorAddress,
            dstValidatorAddress: watched.dstValidatorAddress,
            amountFund: watched.amountFund,
            denom: watched.denom,
          }),
        ]
      }}
      fee={DEFAULT_STAKING_FEE}
      {...(watched.memo ? { memo: watched.memo } : {})}
      invalidateQueryKeys={[
        ['staking', 'delegations'],
        ['staking', 'redelegations'],
        ['staking', 'rewards'],
      ]}
      confirmLabel={t`Redelegate`}
    />
  )
}

// ---------------------------------------------------------------------------
// Withdraw rewards (single validator)
// ---------------------------------------------------------------------------

interface WithdrawRewardsModalProps {
  open: boolean
  onOpenChange: (next: boolean) => void
  validator: Validator | null
  /**
   * Pending reward amount as a raw `DecCoin.amount` string (LegacyDec int,
   * `value × 10^18` in nund) — surfaces in the UI via {@link decCoinToFund}
   * for confirmation. Never treat this as integer nund; the Dec scaling
   * factor makes it ~10^18× too large if fed to {@link nundToFund} directly.
   */
  pendingRewardsNund?: string
}

/**
 * Withdraw pending rewards from a single validator. Distribution module
 * Msg; the rewards land in the delegator's account as spendable balance.
 */
export function WithdrawRewardsModal({
  open,
  onOpenChange,
  validator,
  pendingRewardsNund,
}: WithdrawRewardsModalProps) {
  const { address } = useActiveSigner()
  const { t } = useLingui()

  const moniker = validator?.description?.moniker ?? validator?.operatorAddress ?? ''
  const canSubmit = !!address && !!validator

  return (
    <TxModal
      open={open}
      onOpenChange={onOpenChange}
      title={<Trans>Withdraw rewards from {moniker}</Trans>}
      description={
        <Trans>
          Claim accrued staking rewards from this validator. Rewards land in your account
          as spendable FUND.
        </Trans>
      }
      formBody={
        <div className="flex flex-col gap-2 text-sm">
          {pendingRewardsNund && (
            <p className="text-xs">
              <Trans>
                Pending rewards:{' '}
                <span className="font-mono font-medium">
                  {decCoinToFund(pendingRewardsNund)}
                </span>{' '}
                FUND
              </Trans>
            </p>
          )}
        </div>
      }
      canSubmit={canSubmit}
      buildMsgs={() => {
        if (!address || !validator) return []
        return [
          buildMsgWithdrawDelegatorReward({
            delegatorAddress: address,
            validatorAddress: validator.operatorAddress,
          }),
        ]
      }}
      fee={DEFAULT_STAKING_FEE}
      invalidateQueryKeys={[['staking', 'rewards']]}
      confirmLabel={t`Withdraw rewards`}
    />
  )
}

