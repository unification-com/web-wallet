import { Trans } from '@lingui/react/macro'
import { useMemo } from 'react'

import { AddressLink } from '@/components/AddressLink'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { nundToFund } from '@/lib/msgs/send'
import { useActiveSigner } from '@/lib/signer'
import {
  useRedelegations,
  useUnbondingDelegations,
  useValidators,
  type Validator,
} from '@/lib/staking'
import { formatRelativeDeadline, timestampToDate, useTickingNow } from '@/lib/time'

/**
 * In-flight staking queues — unbonding delegations + redelegations the user
 * has initiated that are still maturing. Renders a card per active queue;
 * returns `null` when both lists are empty so the Staking tab layout stays
 * compact in the common case.
 *
 * Data refreshes via TanStack Query polling (60 s in `useUnbonding…` /
 * `useRedelegations`); the displayed countdown re-renders once a minute via
 * {@link useTickingNow} so deadlines visibly tick without a network round-
 * trip. When a deadline crosses we surface a "Maturing…" badge — the chain
 * sweeps matured entries to spendable balance at its next epoch.
 */
export function InFlightQueues() {
  const { address } = useActiveSigner()
  const { data: unbondings } = useUnbondingDelegations(address)
  const { data: redelegations } = useRedelegations(address)
  const { data: validators } = useValidators()
  const now = useTickingNow(60_000)

  const validatorMap = useMemo(() => {
    const map = new Map<string, Validator>()
    for (const v of validators ?? []) map.set(v.operatorAddress, v)
    return map
  }, [validators])

  const monikerFor = (operatorAddress: string): string =>
    validatorMap.get(operatorAddress)?.description?.moniker ?? operatorAddress

  if (!address) return null

  const hasUnbondings = (unbondings ?? []).some((u) => u.entries.length > 0)
  const hasRedelegations = (redelegations ?? []).some((r) => r.entries.length > 0)
  if (!hasUnbondings && !hasRedelegations) return null

  return (
    <>
      {hasUnbondings && (
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm">
              <Trans>Unbonding</Trans>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-2 flex flex-col gap-2 text-xs">
            <ul className="flex flex-col gap-2">
              {(unbondings ?? []).flatMap((u) =>
                u.entries.map((entry, idx) => {
                  const completion = timestampToDate(entry.completionTime)
                  const rel = formatRelativeDeadline(completion, now)
                  return (
                    <li
                      key={`${u.validatorAddress}-${String(entry.unbondingId)}-${String(idx)}`}
                      className="flex items-center justify-between gap-2 rounded border border-border p-2"
                    >
                      <span className="flex flex-col min-w-0">
                        <span
                          className="font-medium truncate"
                          title={monikerFor(u.validatorAddress)}
                        >
                          {monikerFor(u.validatorAddress)}
                        </span>
                        <AddressLink
                          address={u.validatorAddress}
                          kind="validator"
                          className="text-[10px] text-muted-foreground truncate"
                        />
                      </span>
                      <span className="flex flex-col items-end tabular-nums">
                        <span className="font-mono">
                          <Trans>{nundToFund(entry.balance)} FUND</Trans>
                        </span>
                        <span
                          className="text-[10px] text-muted-foreground"
                          title={completion ? completion.toISOString() : undefined}
                        >
                          {rel.complete ? (
                            <Trans>Maturing…</Trans>
                          ) : (
                            <Trans>completes {rel.label}</Trans>
                          )}
                        </span>
                      </span>
                    </li>
                  )
                }),
              )}
            </ul>
          </CardContent>
        </Card>
      )}

      {hasRedelegations && (
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm">
              <Trans>Redelegating</Trans>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-2 flex flex-col gap-2 text-xs">
            <ul className="flex flex-col gap-2">
              {(redelegations ?? []).flatMap((rr) =>
                rr.entries.map((entry, idx) => {
                  const completion = timestampToDate(entry.redelegationEntry.completionTime)
                  const rel = formatRelativeDeadline(completion, now)
                  const srcMoniker = monikerFor(rr.redelegation.validatorSrcAddress)
                  const dstMoniker = monikerFor(rr.redelegation.validatorDstAddress)
                  return (
                    <li
                      key={`${rr.redelegation.validatorSrcAddress}-${rr.redelegation.validatorDstAddress}-${String(entry.redelegationEntry.creationHeight)}-${String(idx)}`}
                      className="flex items-center justify-between gap-2 rounded border border-border p-2"
                    >
                      <span className="flex flex-col min-w-0">
                        <span className="font-medium truncate">
                          <Trans>
                            {srcMoniker} → {dstMoniker}
                          </Trans>
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          <Trans>destination locked until completion</Trans>
                        </span>
                      </span>
                      <span className="flex flex-col items-end tabular-nums">
                        <span className="font-mono">
                          <Trans>{nundToFund(entry.balance)} FUND</Trans>
                        </span>
                        <span
                          className="text-[10px] text-muted-foreground"
                          title={completion ? completion.toISOString() : undefined}
                        >
                          {rel.complete ? (
                            <Trans>Maturing…</Trans>
                          ) : (
                            <Trans>completes {rel.label}</Trans>
                          )}
                        </span>
                      </span>
                    </li>
                  )
                }),
              )}
            </ul>
          </CardContent>
        </Card>
      )}
    </>
  )
}
