import { zodResolver } from '@hookform/resolvers/zod'
import { Trans, useLingui } from '@lingui/react/macro'
import { useState } from 'react'
import { useForm } from 'react-hook-form'

import { TxModal } from '@/components/TxModal'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { type AuthzGrantRow, type DecodedAuthorization } from '@/lib/authz'
import {
  buildMsgGrantGeneric,
  buildMsgGrantStake,
  buildMsgRevoke,
  DEFAULT_AUTHZ_FEE,
  GenericGrantFormSchema,
  StakeGrantFormSchema,
  type GenericGrantFormValues,
  type StakeGrantFormValues,
} from '@/lib/msgs/authz'
import { type Validator } from '@/lib/staking'

// ---------------------------------------------------------------------------
// Revoke
// ---------------------------------------------------------------------------

interface RevokeGrantModalProps {
  target: AuthzGrantRow | null
  granter: string
  onClose: () => void
}

export function RevokeGrantModal({ target, granter, onClose }: RevokeGrantModalProps) {
  const msgTypeUrl = msgTypeUrlFromDecoded(target?.decoded)
  const open = target !== null && msgTypeUrl !== null

  return (
    <TxModal
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
      title={<Trans>Revoke authorization</Trans>}
      description={
        <Trans>
          Revoking stops the grantee from acting on your behalf for this
          message type. Your stake itself (delegations, rewards) is
          unaffected.
        </Trans>
      }
      formBody={
        target && msgTypeUrl ? (
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
            <dt className="text-muted-foreground">
              <Trans>Grantee</Trans>
            </dt>
            <dd className="font-mono break-all">{target.grantee}</dd>
            <dt className="text-muted-foreground">
              <Trans>Msg type</Trans>
            </dt>
            <dd className="font-mono break-all">{msgTypeUrl}</dd>
          </dl>
        ) : null
      }
      canSubmit={target !== null && msgTypeUrl !== null}
      buildMsgs={() => {
        if (!target || !msgTypeUrl) return []
        return [buildMsgRevoke({ granter, grantee: target.grantee, msgTypeUrl })]
      }}
      fee={DEFAULT_AUTHZ_FEE}
      onSuccess={onClose}
      invalidateQueryKeys={[['authz']]}
      confirmLabel={<Trans>Revoke</Trans>}
    />
  )
}

/**
 * Map a decoded authorization back to the msg-type-url that `MsgRevoke`
 * needs. x/authz keys grants by the inner-Msg type-url, not the wrapping
 * Authorization typeUrl:
 *
 *   - stake authz → `/cosmos.staking.v1beta1.MsgDelegate` is the
 *     canonical entry. Restake-style auto-compounder grants are always
 *     delegate-only (compounders never undelegate). Future undelegate /
 *     redelegate grants ship with the grant form's authzType picker and
 *     get keyed by the matching inner Msg.
 *   - send authz → `/cosmos.bank.v1beta1.MsgSend`.
 *   - generic → the inner msgTypeUrl is exactly what the grantee was
 *     authorised to send.
 *   - unknown → null (the Revoke button is gated off in that row).
 */
function msgTypeUrlFromDecoded(decoded: DecodedAuthorization | undefined): string | null {
  if (!decoded) return null
  if (decoded.kind === 'stake') return '/cosmos.staking.v1beta1.MsgDelegate'
  if (decoded.kind === 'send') return '/cosmos.bank.v1beta1.MsgSend'
  if (decoded.kind === 'generic') return decoded.msgTypeUrl
  return null
}

// ---------------------------------------------------------------------------
// Grant new authorization
// ---------------------------------------------------------------------------
// The modal hosts two flavour forms (Stake / Generic) selected by a
// segmented control. Form state lives in the parent so `<TxModal>`'s
// `canSubmit` + `buildMsgs` props can read from the active flavour.
// SendAuthorization is out of scope for v0.22 (vanishingly rare in
// practice; the M10 tracker's out-of-scope list captures it).

type GrantKind = 'stake' | 'generic'

interface GrantAuthorizationModalProps {
  open: boolean
  onOpenChange: (next: boolean) => void
  granter: string
  validators: readonly Validator[]
}

export function GrantAuthorizationModal({
  open,
  onOpenChange,
  granter,
  validators,
}: GrantAuthorizationModalProps) {
  const { t } = useLingui()
  const [kind, setKind] = useState<GrantKind>('stake')

  const stakeForm = useForm<StakeGrantFormValues>({
    resolver: zodResolver(StakeGrantFormSchema),
    mode: 'onChange',
    defaultValues: {
      grantee: '',
      authzType: 'delegate',
      maxFund: '',
      listMode: 'any',
      validators: [],
      expiresAtMs: undefined,
    },
  })

  const genericForm = useForm<GenericGrantFormValues>({
    resolver: zodResolver(GenericGrantFormSchema),
    mode: 'onChange',
    defaultValues: { grantee: '', msgTypeUrl: '', expiresAtMs: undefined },
  })

  const canSubmit = kind === 'stake' ? stakeForm.formState.isValid : genericForm.formState.isValid

  const buildMsgs = () => {
    if (kind === 'stake') {
      const values = stakeForm.getValues()
      return [buildMsgGrantStake({ granter, values })]
    }
    const values = genericForm.getValues()
    return [buildMsgGrantGeneric({ granter, values })]
  }

  const onSuccess = () => {
    stakeForm.reset()
    genericForm.reset()
    setKind('stake')
    onOpenChange(false)
  }

  return (
    <TxModal
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          // Reset both forms on cancel so the next open starts clean.
          stakeForm.reset()
          genericForm.reset()
        }
        onOpenChange(next)
      }}
      title={<Trans>Grant authorization</Trans>}
      description={
        <Trans>
          Authorise another account to send specific Msgs on your behalf.
          For Restake-style auto-compounding, grant{' '}
          <span className="font-mono">Stake</span> to the bot
          operator&apos;s address.
        </Trans>
      }
      formBody={
        <div className="flex flex-col gap-3">
          <div className="flex gap-2 text-[11px]">
            <button
              type="button"
              onClick={() => setKind('stake')}
              className={
                'flex-1 rounded border px-2 py-1 ' +
                (kind === 'stake' ? 'border-primary bg-primary/5' : 'border-border')
              }
            >
              <Trans>Stake</Trans>
            </button>
            <button
              type="button"
              onClick={() => setKind('generic')}
              className={
                'flex-1 rounded border px-2 py-1 ' +
                (kind === 'generic' ? 'border-primary bg-primary/5' : 'border-border')
              }
            >
              <Trans>Generic</Trans>
            </button>
          </div>
          {kind === 'stake' ? (
            <StakeGrantFields form={stakeForm} validators={validators} t={t} />
          ) : (
            <GenericGrantFields form={genericForm} t={t} />
          )}
        </div>
      }
      canSubmit={canSubmit}
      buildMsgs={buildMsgs}
      fee={DEFAULT_AUTHZ_FEE}
      onSuccess={onSuccess}
      invalidateQueryKeys={[['authz']]}
      confirmLabel={<Trans>Grant</Trans>}
    />
  )
}

// ---------------------------------------------------------------------------
// Per-flavour field components
// ---------------------------------------------------------------------------

interface StakeGrantFieldsProps {
  form: ReturnType<typeof useForm<StakeGrantFormValues>>
  validators: readonly Validator[]
  t: ReturnType<typeof useLingui>['t']
}

function StakeGrantFields({ form, validators, t }: StakeGrantFieldsProps) {
  return (
    <div className="flex flex-col gap-3 text-xs">
      <div className="flex flex-col gap-1">
        <Label htmlFor="grant-grantee">
          <Trans>Grantee (bot address)</Trans>
        </Label>
        <Input
          id="grant-grantee"
          {...form.register('grantee')}
          placeholder={t`und1…`}
          className="font-mono"
        />
        {form.formState.errors.grantee && (
          <span className="text-xs text-destructive">
            {form.formState.errors.grantee.message}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="grant-authz-type">
          <Trans>Authorization</Trans>
        </Label>
        <select
          id="grant-authz-type"
          {...form.register('authzType')}
          className="h-9 rounded-md border border-input bg-background px-2 text-xs"
        >
          <option value="delegate">{t`Delegate (auto-compounder pattern)`}</option>
          <option value="undelegate">{t`Undelegate`}</option>
          <option value="redelegate">{t`Redelegate`}</option>
          <option value="any">{t`Any staking action`}</option>
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="grant-max">
          <Trans>Spend cap (FUND, optional)</Trans>
        </Label>
        <Input
          id="grant-max"
          {...form.register('maxFund')}
          placeholder={t`e.g. 1000`}
          className="font-mono"
        />
        <span className="text-[10px] text-muted-foreground">
          <Trans>
            Leave blank for no cap. Restake convention: leave blank since
            the cap can be replaced by a fresh grant if needed.
          </Trans>
        </span>
      </div>

      <p className="text-[10px] text-muted-foreground">
        <Trans>
          Validator scope (allow / deny list of {validators.length}{' '}
          known validators) ships as a follow-up. For v0.22 grants apply
          to any validator — match Restake&apos;s default and grant a
          per-validator cap separately when needed.
        </Trans>
      </p>
    </div>
  )
}

interface GenericGrantFieldsProps {
  form: ReturnType<typeof useForm<GenericGrantFormValues>>
  t: ReturnType<typeof useLingui>['t']
}

function GenericGrantFields({ form, t }: GenericGrantFieldsProps) {
  return (
    <div className="flex flex-col gap-3 text-xs">
      <div className="rounded border border-destructive/40 bg-destructive/5 p-2 text-[11px] text-destructive">
        <Trans>
          Generic grants have no scope guards — the grantee can broadcast
          any Msg of the chosen type on your behalf. Only grant if you
          fully trust the grantee.
        </Trans>
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="grant-grantee-generic">
          <Trans>Grantee</Trans>
        </Label>
        <Input
          id="grant-grantee-generic"
          {...form.register('grantee')}
          placeholder={t`und1…`}
          className="font-mono"
        />
        {form.formState.errors.grantee && (
          <span className="text-xs text-destructive">
            {form.formState.errors.grantee.message}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="grant-msg-type">
          <Trans>Msg type URL</Trans>
        </Label>
        <Input
          id="grant-msg-type"
          {...form.register('msgTypeUrl')}
          placeholder={t`/cosmos.bank.v1beta1.MsgSend`}
          className="font-mono"
        />
        {form.formState.errors.msgTypeUrl && (
          <span className="text-xs text-destructive">
            {form.formState.errors.msgTypeUrl.message}
          </span>
        )}
      </div>
    </div>
  )
}
