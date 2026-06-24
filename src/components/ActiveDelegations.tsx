import { Trans, useLingui } from '@lingui/react/macro'
import { useMemo, useState } from 'react'

import { AddressLink } from '@/components/AddressLink'
import { RefreshButton } from '@/components/RefreshButton'
import {
  RedelegateModal,
  UndelegateModal,
  WithdrawRewardsModal,
} from '@/components/StakingActionModals'
import { TxModal } from '@/components/TxModal'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { decCoinToFund, nundToFund } from '@/lib/msgs/send'
import { buildMsgsWithdrawAllRewards } from '@/lib/msgs/staking'
import { useActiveSigner } from '@/lib/signer'
import {
  useDelegations,
  useDelegatorRewards,
  useValidators,
  type Validator,
} from '@/lib/staking'

/**
 * Active-delegations list — one row per validator the user has stake
 * with. Each row exposes Undelegate / Redelegate / Withdraw-rewards
 * actions via the shared `<TxModal />` pattern. Bulk withdraw button at
 * the top emits one `MsgWithdrawDelegatorReward` per delegated validator
 * in a single Tx.
 */
export function ActiveDelegations() {
  const { address } = useActiveSigner()
  const { t } = useLingui()
  const { data: delegations, isLoading } = useDelegations(address)
  const { data: validators } = useValidators()
  const { data: rewards } = useDelegatorRewards(address)

  const [undelegateTarget, setUndelegateTarget] = useState<{
    validator: Validator
    delegationNund: string
  } | null>(null)
  const [redelegateTarget, setRedelegateTarget] = useState<{
    validator: Validator
    delegationNund: string
  } | null>(null)
  const [withdrawTarget, setWithdrawTarget] = useState<{
    validator: Validator
    rewardsNund: string
  } | null>(null)
  const [bulkWithdrawOpen, setBulkWithdrawOpen] = useState(false)

  // Validator lookup map for O(1) moniker resolution per delegation row.
  const validatorMap = useMemo(() => {
    const map = new Map<string, Validator>()
    for (const v of validators ?? []) map.set(v.operatorAddress, v)
    return map
  }, [validators])

  // Pending rewards by validator address. Distribution Dec strings have
  // fractional parts; we treat them as "approximate nund" for display.
  const rewardsByValidator = useMemo(() => {
    const map = new Map<string, string>()
    for (const r of rewards?.rewards ?? []) {
      const nundReward = r.reward.find((c) => c.denom === 'nund')
      if (nundReward) map.set(r.validatorAddress, nundReward.amount)
    }
    return map
  }, [rewards])

  const totalRewardsNund =
    rewards?.total.find((c) => c.denom === 'nund')?.amount ?? '0'
  const hasAnyRewards = (delegations ?? []).some((d) => {
    const r = rewardsByValidator.get(d.delegation.validatorAddress)
    return r && BigInt(r.split('.')[0] ?? '0') > 0n
  })

  if (!address) return null

  return (
    <>
      <Card>
        <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0 gap-2">
          <CardTitle className="text-sm">
            <Trans>Your delegations</Trans>
          </CardTitle>
          <div className="flex items-center gap-1">
            {totalRewardsNund && BigInt(totalRewardsNund.split('.')[0] ?? '0') > 0n && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setBulkWithdrawOpen(true)}
                disabled={!hasAnyRewards}
              >
                <Trans>
                  Withdraw all (~{decCoinToFund(totalRewardsNund)} FUND)
                </Trans>
              </Button>
            )}
            <RefreshButton queryKeys={[['staking']]} />
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-2 flex flex-col gap-2 text-xs">
          {isLoading && (
            <p className="text-muted-foreground">
              <Trans>Loading delegations…</Trans>
            </p>
          )}
          {!isLoading && (delegations ?? []).length === 0 && (
            <p className="text-muted-foreground italic">
              <Trans>
                No active delegations. Pick a validator above to start earning rewards.
              </Trans>
            </p>
          )}
          <ul className="flex flex-col gap-2">
            {(delegations ?? []).map((dr) => {
              const valAddr = dr.delegation.validatorAddress
              const validator = validatorMap.get(valAddr)
              const moniker = validator?.description?.moniker ?? valAddr
              const stakeNund = dr.balance.amount
              const pending = rewardsByValidator.get(valAddr) ?? '0'
              const pendingHasValue = BigInt(pending.split('.')[0] ?? '0') > 0n
              return (
                <li
                  key={valAddr}
                  className="flex flex-col gap-1 rounded border border-border p-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex flex-col min-w-0">
                      <span className="font-medium truncate" title={moniker}>
                        {moniker}
                      </span>
                      <AddressLink
                        address={valAddr}
                        kind="validator"
                        className="text-[10px] text-muted-foreground truncate"
                      />
                    </span>
                    <span className="flex flex-col items-end tabular-nums">
                      <span className="font-mono">
                        <Trans>{nundToFund(stakeNund)} FUND</Trans>
                      </span>
                      {pendingHasValue && (
                        <span className="text-[10px] text-green-700">
                          <Trans>+{decCoinToFund(pending)} pending</Trans>
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="flex gap-1 flex-wrap">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 px-2 text-[11px]"
                      disabled={!validator}
                      onClick={() => {
                        if (validator) {
                          setUndelegateTarget({ validator, delegationNund: stakeNund })
                        }
                      }}
                    >
                      <Trans>Undelegate</Trans>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 px-2 text-[11px]"
                      disabled={!validator}
                      onClick={() => {
                        if (validator) {
                          setRedelegateTarget({ validator, delegationNund: stakeNund })
                        }
                      }}
                    >
                      <Trans>Redelegate</Trans>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 px-2 text-[11px]"
                      disabled={!validator || !pendingHasValue}
                      onClick={() => {
                        if (validator) {
                          setWithdrawTarget({ validator, rewardsNund: pending })
                        }
                      }}
                      title={
                        !pendingHasValue
                          ? t`No rewards to withdraw from this validator yet.`
                          : undefined
                      }
                    >
                      <Trans>Withdraw</Trans>
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
        </CardContent>
      </Card>

      <UndelegateModal
        open={undelegateTarget !== null}
        onOpenChange={(next) => {
          if (!next) setUndelegateTarget(null)
        }}
        srcValidator={undelegateTarget?.validator ?? null}
        {...(undelegateTarget?.delegationNund
          ? { currentDelegationNund: undelegateTarget.delegationNund }
          : {})}
      />

      <RedelegateModal
        open={redelegateTarget !== null}
        onOpenChange={(next) => {
          if (!next) setRedelegateTarget(null)
        }}
        srcValidator={redelegateTarget?.validator ?? null}
        {...(redelegateTarget?.delegationNund
          ? { currentDelegationNund: redelegateTarget.delegationNund }
          : {})}
      />

      <WithdrawRewardsModal
        open={withdrawTarget !== null}
        onOpenChange={(next) => {
          if (!next) setWithdrawTarget(null)
        }}
        validator={withdrawTarget?.validator ?? null}
        {...(withdrawTarget?.rewardsNund
          ? { pendingRewardsNund: withdrawTarget.rewardsNund }
          : {})}
      />

      <TxModal
        open={bulkWithdrawOpen}
        onOpenChange={setBulkWithdrawOpen}
        title={<Trans>Withdraw all rewards</Trans>}
        description={
          <Trans>
            Claim rewards from every validator you delegate to in a single transaction.
            Gas scales with the number of delegations.
          </Trans>
        }
        formBody={
          <div className="flex flex-col gap-2 text-sm">
            <p>
              <Trans>
                Total pending across all delegations:{' '}
                <span className="font-mono font-medium">
                  {decCoinToFund(totalRewardsNund)}
                </span>{' '}
                FUND
              </Trans>
            </p>
            <p className="text-xs text-muted-foreground">
              <Trans>
                {(delegations ?? []).filter((d) => {
                  const r = rewardsByValidator.get(d.delegation.validatorAddress)
                  return r && BigInt(r.split('.')[0] ?? '0') > 0n
                }).length}{' '}
                MsgWithdrawDelegatorReward messages will be submitted in one Tx.
              </Trans>
            </p>
          </div>
        }
        canSubmit={hasAnyRewards}
        buildMsgs={() => {
          if (!address) return []
          // Only include validators with pending rewards — Msgs to no-reward
          // validators just waste gas (they succeed but do nothing).
          const withRewards = (delegations ?? [])
            .map((d) => d.delegation.validatorAddress)
            .filter((v) => {
              const r = rewardsByValidator.get(v)
              return r && BigInt(r.split('.')[0] ?? '0') > 0n
            })
          return buildMsgsWithdrawAllRewards({
            delegatorAddress: address,
            validatorAddresses: withRewards,
          })
        }}
        // Bulk-withdraw gas scales with Msg count. Bump generously.
        fee={{
          amount: [{ denom: 'nund', amount: '50000000' }],
          gas: '500000',
        }}
        invalidateQueryKeys={[['staking', 'rewards']]}
        confirmLabel={t`Withdraw all`}
      />
    </>
  )
}
