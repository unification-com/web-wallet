import { Trans, useLingui } from '@lingui/react/macro'
import { useState } from 'react'

import { AddressLink } from '@/components/AddressLink'
import { GrantAuthorizationModal, RevokeGrantModal } from '@/components/AuthzActionModals'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  AuthorizationType,
  GENERIC_AUTHORIZATION_URL,
  SEND_AUTHORIZATION_URL,
  STAKE_AUTHORIZATION_URL,
  useGranterGrants,
  type AuthzGrantRow,
  type DecodedAuthorization,
} from '@/lib/authz'
import { nundToFund } from '@/lib/msgs/send'
import { useActiveSigner } from '@/lib/signer'
import { useValidators, type Validator } from '@/lib/staking'

/**
 * Authz management surface — lives inside the Settings panel as a card.
 * Lists every grant the active signer has given out (the common case —
 * Restake-style auto-compounder grants in particular), with a Revoke
 * action per row + a Grant-new button at the bottom.
 *
 * Grants-received (active signer is grantee) is out of scope for v0.22 —
 * vanishingly rare for regular wallet users; the Restake-style bots that
 * receive thousands of grants don't run this wallet.
 */
export function AuthzPanel() {
  const { address } = useActiveSigner()
  const { data: grants, isLoading } = useGranterGrants(address)
  const { data: validators } = useValidators()
  const [revokeTarget, setRevokeTarget] = useState<AuthzGrantRow | null>(null)
  const [grantOpen, setGrantOpen] = useState(false)

  if (!address) return null

  return (
    <Card>
      <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-sm">
          <Trans>Authorizations</Trans>
        </CardTitle>
        <Button size="sm" variant="outline" onClick={() => setGrantOpen(true)}>
          <Trans>Grant new</Trans>
        </Button>
      </CardHeader>
      <CardContent className="p-4 pt-2 flex flex-col gap-2 text-xs">
        <p className="text-[11px] text-muted-foreground">
          <Trans>
            Grants you&apos;ve given to other accounts (typically
            auto-compounder bots). Revoking stops the grantee from acting
            on your behalf; your stake itself is unaffected.
          </Trans>
        </p>
        {isLoading && (
          <p className="text-muted-foreground">
            <Trans>Loading grants…</Trans>
          </p>
        )}
        {!isLoading && (grants ?? []).length === 0 && (
          <p className="text-muted-foreground italic">
            <Trans>
              No active grants. Grant an authorization to enable a
              third-party (e.g. an auto-compounder) to act on your
              behalf for specific message types.
            </Trans>
          </p>
        )}
        <ul className="flex flex-col gap-2">
          {(grants ?? []).map((row) => (
            <GrantRow
              key={`${row.grantee}-${row.authorization?.typeUrl ?? 'unknown'}-${(
                row.decoded.kind === 'generic' ? row.decoded.msgTypeUrl : ''
              )}`}
              row={row}
              validators={validators ?? []}
              onRevoke={() => setRevokeTarget(row)}
            />
          ))}
        </ul>
      </CardContent>

      <RevokeGrantModal
        target={revokeTarget}
        granter={address}
        onClose={() => setRevokeTarget(null)}
      />
      <GrantAuthorizationModal
        open={grantOpen}
        onOpenChange={setGrantOpen}
        granter={address}
        validators={validators ?? []}
      />
    </Card>
  )
}

interface GrantRowProps {
  row: AuthzGrantRow
  validators: readonly Validator[]
  onRevoke: () => void
}

function GrantRow({ row, validators, onRevoke }: GrantRowProps) {
  const { t } = useLingui()
  const expiryLabel = formatExpiry(row.expiresAtMs, t)
  return (
    <li className="flex flex-col gap-1 rounded border border-border p-2">
      <div className="flex items-center justify-between gap-2">
        <span className="flex flex-col min-w-0 gap-0.5">
          <span className="text-[10px] uppercase tracking-[0.06em] text-muted-foreground font-mono">
            <Trans>Grantee</Trans>
          </span>
          <AddressLink address={row.grantee} className="text-[11px] truncate" />
        </span>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-[11px] px-2 shrink-0"
          onClick={onRevoke}
        >
          <Trans>Revoke</Trans>
        </Button>
      </div>
      <AuthorizationSummary decoded={row.decoded} validators={validators} />
      <span className="text-[10px] text-muted-foreground">{expiryLabel}</span>
    </li>
  )
}

function AuthorizationSummary({
  decoded,
  validators,
}: {
  decoded: DecodedAuthorization
  validators: readonly Validator[]
}) {
  if (decoded.kind === 'stake') {
    const action = stakeActionLabel(decoded.authzType)
    const scope = (() => {
      if (decoded.allowList && decoded.allowList.length > 0) {
        const monikers = decoded.allowList.map((v) => monikerOf(v, validators)).join(', ')
        return <Trans>allow: {monikers}</Trans>
      }
      if (decoded.denyList && decoded.denyList.length > 0) {
        const monikers = decoded.denyList.map((v) => monikerOf(v, validators)).join(', ')
        return <Trans>deny: {monikers}</Trans>
      }
      return <Trans>any validator</Trans>
    })()
    const cap =
      decoded.maxTokens?.denom === 'nund' ? (
        <>
          {' '}
          ·{' '}
          <Trans>
            up to <span className="font-mono">{nundToFund(decoded.maxTokens.amount)}</span> FUND
          </Trans>
        </>
      ) : null
    return (
      <span className="text-[11px]">
        <span className="font-medium">{action}</span> — {scope}
        {cap}
      </span>
    )
  }
  if (decoded.kind === 'send') {
    const cap = decoded.spendLimit
      .filter((c) => c.denom === 'nund')
      .map((c) => `${nundToFund(c.amount)} FUND`)
      .join(', ')
    const recipients =
      decoded.allowList.length > 0 ? (
        <Trans>to {decoded.allowList.length} allow-listed address(es)</Trans>
      ) : (
        <Trans>to any recipient</Trans>
      )
    return (
      <span className="text-[11px]">
        <span className="font-medium">
          <Trans>Send</Trans>
        </span>{' '}
        {cap && (
          <>
            — <span className="font-mono">{cap}</span>{' '}
          </>
        )}
        — {recipients}
      </span>
    )
  }
  if (decoded.kind === 'generic') {
    return (
      <span className="text-[11px]">
        <span className="font-medium">
          <Trans>Generic</Trans>
        </span>{' '}
        — <span className="font-mono">{decoded.msgTypeUrl}</span>{' '}
        <span className="text-destructive">
          <Trans>(no scope guards)</Trans>
        </span>
      </span>
    )
  }
  return (
    <span className="text-[11px] text-muted-foreground">
      <Trans>
        Unknown authorization type: <span className="font-mono">{decoded.typeUrl}</span>
      </Trans>
    </span>
  )
}

function stakeActionLabel(type: AuthorizationType): JSX.Element {
  switch (type) {
    case AuthorizationType.AUTHORIZATION_TYPE_DELEGATE:
      return <Trans>Delegate</Trans>
    case AuthorizationType.AUTHORIZATION_TYPE_UNDELEGATE:
      return <Trans>Undelegate</Trans>
    case AuthorizationType.AUTHORIZATION_TYPE_REDELEGATE:
      return <Trans>Redelegate</Trans>
    default:
      return <Trans>Any staking action</Trans>
  }
}

function monikerOf(valoper: string, validators: readonly Validator[]): string {
  const match = validators.find((v) => v.operatorAddress === valoper)
  if (match?.description?.moniker) return match.description.moniker
  // Fall back to a truncated valoper for unknown / mid-load — better than
  // the full 48-char operator address eating the row.
  return `${valoper.slice(0, 12)}…${valoper.slice(-4)}`
}

function formatExpiry(
  expiresAtMs: number | null,
  t: (template: TemplateStringsArray, ...args: unknown[]) => string,
): string {
  if (expiresAtMs === null) return t`never expires`
  const now = Date.now()
  const delta = expiresAtMs - now
  if (delta < 0) {
    const ago = Math.floor(-delta / 86_400_000)
    return ago < 1
      ? t`expired earlier today`
      : t`expired ${ago} day${ago === 1 ? '' : 's'} ago`
  }
  const days = Math.floor(delta / 86_400_000)
  if (days > 365) {
    const years = Math.floor(days / 365)
    return t`expires in ${years} year${years === 1 ? '' : 's'}`
  }
  if (days >= 30) {
    const months = Math.floor(days / 30)
    return t`expires in ${months} month${months === 1 ? '' : 's'}`
  }
  if (days >= 1) return t`expires in ${days} day${days === 1 ? '' : 's'}`
  return t`expires later today`
}

// Re-export the URL constants so debugging contexts have a single import point.
export {
  GENERIC_AUTHORIZATION_URL,
  SEND_AUTHORIZATION_URL,
  STAKE_AUTHORIZATION_URL,
}
