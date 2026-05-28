import { Trans, useLingui } from '@lingui/react/macro'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useMemo, useState } from 'react'

import { AddressLink } from '@/components/AddressLink'
import { DelegateModal } from '@/components/DelegateModal'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useActiveSigner } from '@/lib/signer'
import {
  commissionRate,
  decRateToFraction,
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
 * Detail panel for a validator row — surfaced via the chevron toggle on
 * the row header. Closes the M2.1 deferral (operator address copyable,
 * commission max-rate + max-change-rate, last commission update,
 * minimum self-delegation, description metadata) using only the data
 * already present in the `Validator` proto.
 *
 * Delegator count + actual self-bond amount are NOT in the proto —
 * surfacing them would require an extra per-row Delegation lookup. Punt
 * to a future polish if user demand surfaces.
 */
function ValidatorDetail({ validator }: { validator: Validator }) {
  const { t, i18n } = useLingui()
  const rates = validator.commission?.commissionRates
  const maxRatePct = (decRateToFraction(rates?.maxRate) * 100).toFixed(2)
  const maxChangePct = (decRateToFraction(rates?.maxChangeRate) * 100).toFixed(2)
  const updateTime = validator.commission?.updateTime
  const hasMinSelf =
    validator.minSelfDelegation !== '' && validator.minSelfDelegation !== '0'
  const desc = validator.description
  const hasDescription =
    desc?.website || desc?.identity || desc?.details || desc?.securityContact

  return (
    <dl className="ml-7 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 border-t border-border/60 pt-1.5 text-[10px]">
      <dt className="text-muted-foreground">
        <Trans>Commission max</Trans>
      </dt>
      <dd className="font-mono">{maxRatePct}%</dd>

      <dt className="text-muted-foreground">
        <Trans>Max change / day</Trans>
      </dt>
      <dd className="font-mono">{maxChangePct}%</dd>

      {updateTime && (
        <>
          <dt className="text-muted-foreground">
            <Trans>Last commission update</Trans>
          </dt>
          <dd className="font-mono" title={updateTime.toISOString()}>
            {i18n.date(updateTime, { dateStyle: 'medium' })}
          </dd>
        </>
      )}

      {hasMinSelf && (
        <>
          <dt className="text-muted-foreground">
            <Trans>Min self-delegation</Trans>
          </dt>
          <dd className="font-mono">{formatTokensAsFund(validator.minSelfDelegation)} FUND</dd>
        </>
      )}

      {desc?.website && (
        <>
          <dt className="text-muted-foreground">
            <Trans>Website</Trans>
          </dt>
          <dd className="break-all">
            <a
              href={desc.website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              {desc.website}
            </a>
          </dd>
        </>
      )}
      {desc?.identity && (
        <>
          <dt className="text-muted-foreground">
            <Trans>Identity</Trans>
          </dt>
          <dd className="font-mono break-all" title={t`Keybase identity hash`}>
            {desc.identity}
          </dd>
        </>
      )}
      {desc?.securityContact && (
        <>
          <dt className="text-muted-foreground">
            <Trans>Security contact</Trans>
          </dt>
          <dd className="break-all">{desc.securityContact}</dd>
        </>
      )}
      {desc?.details && (
        <>
          <dt className="text-muted-foreground">
            <Trans>Details</Trans>
          </dt>
          <dd className="break-words whitespace-pre-line">{desc.details}</dd>
        </>
      )}
      {!hasDescription && (
        <span className="col-span-2 text-muted-foreground italic">
          <Trans>No description metadata published.</Trans>
        </span>
      )}
    </dl>
  )
}

/**
 * Validator list. Sorts active validators first by voting power, then
 * inactive. Moniker substring search filters in place. Each row toggles
 * a detail panel via the chevron — commission max-rate / max-change-rate
 * + last update + min self-delegation + description metadata when set.
 *
 * Single-expanded-id pattern (not per-row state) keeps the list compact
 * — opening one row closes any other. Operator-validated UX choice
 * during M12.3 polish, where alternative "always-open per row" felt too
 * busy for the popup-width surface.
 */
export function Validators() {
  const { t } = useLingui()
  const { data: validators, isLoading, isError, error } = useValidators()
  const { address } = useActiveSigner()
  const { data: delegations } = useDelegations(address)
  const [search, setSearch] = useState('')
  const [delegateTarget, setDelegateTarget] = useState<Validator | null>(null)
  const [expandedAddress, setExpandedAddress] = useState<string | null>(null)

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
              const expanded = expandedAddress === v.operatorAddress
              // Rank prefix `01`, `02`, … (two-digit pad to keep the column
              // tidy; larger sets just wrap to three digits naturally).
              const rank = (i + 1).toString().padStart(2, '0')
              return (
                <li
                  key={v.operatorAddress}
                  className={
                    'flex flex-col gap-1 rounded border p-2 text-xs ' +
                    (canDelegate ? 'border-border' : 'border-border opacity-60')
                  }
                >
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedAddress(expanded ? null : v.operatorAddress)
                      }
                      className="shrink-0 inline-flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-accent"
                      aria-expanded={expanded}
                      aria-label={expanded ? t`Hide details` : t`Show details`}
                    >
                      {expanded ? (
                        <ChevronDown className="h-3 w-3" />
                      ) : (
                        <ChevronRight className="h-3 w-3" />
                      )}
                    </button>
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
                      <AddressLink
                        address={v.operatorAddress}
                        kind="validator"
                        className="text-[10px] text-muted-foreground truncate"
                      />
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
                  </div>
                  {expanded && <ValidatorDetail validator={v} />}
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
