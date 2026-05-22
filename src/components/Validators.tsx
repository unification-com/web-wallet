import { Trans, useLingui } from '@lingui/react/macro'
import { useMemo, useState } from 'react'

import { DelegateModal } from '@/components/DelegateModal'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useActiveSigner } from '@/lib/signer'
import {
  commissionRate,
  isActiveValidator,
  sortValidators,
  useDelegations,
  useValidators,
  type Validator,
} from '@/lib/staking'

/** Format a `Dec`-string token amount (nund) as FUND with thousand separators. */
function formatTokensAsFund(tokens: string): string {
  try {
    const big = BigInt(tokens)
    const nund = 1_000_000_000n
    const whole = big / nund
    // Drop the fractional part on validator voting power — it's millions of
    // FUND; sub-FUND precision is noise.
    return whole.toLocaleString()
  } catch {
    return '0'
  }
}

/**
 * Validator list — M2.1 scaffold. Sorts active validators first by voting
 * power, then inactive. Moniker substring search filters in place.
 *
 * Per-validator detail expansion (operator address, commission rate +
 * delegate / undelegate actions) lands in subsequent M2 sub-tasks.
 */
export function Validators() {
  const { t } = useLingui()
  const { data: validators, isLoading, isError, error } = useValidators()
  const { address } = useActiveSigner()
  const { data: delegations } = useDelegations(address)
  const [search, setSearch] = useState('')
  const [delegateTarget, setDelegateTarget] = useState<Validator | null>(null)

  // Pre-compute the set of validator operator addresses the user has stake
  // with — used to surface a "staked" chip on those rows.
  const stakedSet = useMemo<Set<string>>(() => {
    const s = new Set<string>()
    for (const d of delegations ?? []) s.add(d.delegation.validatorAddress)
    return s
  }, [delegations])

  const filteredSorted = useMemo<Validator[]>(() => {
    if (!validators) return []
    const sorted = sortValidators(validators)
    const needle = search.trim().toLowerCase()
    if (!needle) return sorted
    return sorted.filter((v) => v.description?.moniker?.toLowerCase().includes(needle))
  }, [validators, search])

  return (
    <Card>
      <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm">
          <Trans>Validators</Trans>
        </CardTitle>
        {validators && (
          <span className="text-xs text-muted-foreground">
            <Trans>
              {filteredSorted.length} of {validators.length}
            </Trans>
          </span>
        )}
      </CardHeader>
      <CardContent className="p-4 pt-2 flex flex-col gap-2">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t`Filter by moniker…`}
          className="text-xs"
        />

        {isLoading && (
          <p className="text-xs text-muted-foreground">
            <Trans>Loading validators…</Trans>
          </p>
        )}
        {isError && (
          <p className="text-xs text-destructive break-words">
            <Trans>
              Failed to load: {error instanceof Error ? error.message : String(error)}
            </Trans>
          </p>
        )}

        {filteredSorted.length > 0 && (
          <ul className="flex flex-col gap-1 max-h-[400px] overflow-y-auto">
            {filteredSorted.map((v, i) => {
              const active = isActiveValidator(v)
              const moniker = v.description?.moniker ?? v.operatorAddress
              const commissionPct = (commissionRate(v) * 100).toFixed(2)
              const canDelegate = active && !v.jailed
              const staked = stakedSet.has(v.operatorAddress)
              // Rank prefix `01`, `02`, … (two-digit pad to keep the column
              // tidy; larger sets just wrap to three digits naturally).
              const rank = (i + 1).toString().padStart(2, '0')
              return (
                <li
                  key={v.operatorAddress}
                  className={
                    'flex items-center justify-between gap-2 rounded border p-2 text-xs ' +
                    (canDelegate ? 'border-border' : 'border-border opacity-60')
                  }
                >
                  <span className="font-mono text-[10px] text-muted-foreground shrink-0 w-6 text-right">
                    {rank}
                  </span>
                  <span className="flex flex-col flex-1 min-w-0">
                    <span className="flex items-center gap-1.5">
                      <span className="font-medium truncate" title={moniker}>
                        {moniker}
                      </span>
                      {staked && (
                        <span className="text-[9px] px-1 py-0.5 rounded uppercase tracking-wider font-mono bg-primary/15 text-primary shrink-0">
                          <Trans>staked</Trans>
                        </span>
                      )}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-mono truncate">
                      {v.operatorAddress}
                    </span>
                  </span>
                  <span className="flex flex-col items-end text-[10px]">
                    {active ? (
                      <span className="rounded bg-primary/10 text-primary px-1.5 py-0.5 font-medium">
                        <Trans>ACTIVE</Trans>
                      </span>
                    ) : (
                      <span className="rounded bg-muted text-muted-foreground px-1.5 py-0.5">
                        <Trans>INACTIVE</Trans>
                      </span>
                    )}
                    {v.jailed && (
                      <span className="text-destructive mt-0.5">
                        <Trans>JAILED</Trans>
                      </span>
                    )}
                  </span>
                  <span className="flex flex-col items-end text-[10px] tabular-nums font-mono">
                    <span className="text-foreground">
                      <span className="text-muted-foreground">VP </span>
                      {formatTokensAsFund(v.tokens)}
                    </span>
                    <span className="text-muted-foreground">
                      COMM {commissionPct}%
                    </span>
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-[11px] px-2 shrink-0"
                    disabled={!canDelegate}
                    onClick={() => setDelegateTarget(v)}
                    title={
                      canDelegate
                        ? t`Delegate to ${moniker}`
                        : t`Cannot delegate to inactive or jailed validators`
                    }
                  >
                    <Trans>Delegate</Trans>
                  </Button>
                </li>
              )
            })}
          </ul>
        )}

        {!isLoading && filteredSorted.length === 0 && validators && (
          <p className="text-xs text-muted-foreground italic">
            <Trans>No validators match the filter.</Trans>
          </p>
        )}
      </CardContent>

      <DelegateModal
        open={delegateTarget !== null}
        onOpenChange={(next) => {
          if (!next) setDelegateTarget(null)
        }}
        validator={delegateTarget}
      />
    </Card>
  )
}
