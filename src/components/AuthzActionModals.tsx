import { zodResolver } from '@hookform/resolvers/zod'
import { Trans, useLingui } from '@lingui/react/macro'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'

import { TxModal } from '@/components/TxModal'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { type AuthzGrantRow, type DecodedAuthorisation } from '@/lib/authz'
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
import { sortValidators, type Validator } from '@/lib/staking'

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
      title={<Trans>Revoke authorisation</Trans>}
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
 * Map a decoded authorisation back to the msg-type-url that `MsgRevoke`
 * needs. x/authz keys grants by the inner-Msg type-url, not the wrapping
 * Authorisation typeUrl:
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
function msgTypeUrlFromDecoded(decoded: DecodedAuthorisation | undefined): string | null {
  if (!decoded) return null
  if (decoded.kind === 'stake') return '/cosmos.staking.v1beta1.MsgDelegate'
  if (decoded.kind === 'send') return '/cosmos.bank.v1beta1.MsgSend'
  if (decoded.kind === 'generic') return decoded.msgTypeUrl
  return null
}

// ---------------------------------------------------------------------------
// Grant new authorisation
// ---------------------------------------------------------------------------
// The modal hosts two flavour forms (Stake / Generic) selected by a
// segmented control. Form state lives in the parent so `<TxModal>`'s
// `canSubmit` + `buildMsgs` props can read from the active flavour.
// SendAuthorization is out of scope for v0.22 (vanishingly rare in
// practice; the M10 tracker's out-of-scope list captures it).

type GrantKind = 'stake' | 'generic'

interface GrantAuthorisationModalProps {
  open: boolean
  onOpenChange: (next: boolean) => void
  granter: string
  validators: readonly Validator[]
}

export function GrantAuthorisationModal({
  open,
  onOpenChange,
  granter,
  validators,
}: GrantAuthorisationModalProps) {
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
      title={<Trans>Grant authorisation</Trans>}
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
            <StakeGrantFields form={stakeForm} validators={validators} />
          ) : (
            <GenericGrantFields form={genericForm} />
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
}

function StakeGrantFields({ form, validators }: StakeGrantFieldsProps) {
  // Use lingui locally — passing `t` as a prop prevents the babel macro
  // from compiling the template-literal calls below (the plugin only
  // recognises `t` symbols bound in the same scope via useLingui() or
  // the `@lingui/core/macro` import).
  const { t } = useLingui()
  const listMode = form.watch('listMode')
  const selected = form.watch('validators')

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
          <Trans>Authorisation</Trans>
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

      <div className="flex flex-col gap-1">
        <Label htmlFor="grant-list-mode">
          <Trans>Validator scope</Trans>
        </Label>
        <select
          id="grant-list-mode"
          {...form.register('listMode')}
          className="h-9 rounded-md border border-input bg-background px-2 text-xs"
        >
          <option value="any">{t`Any validator`}</option>
          <option value="allow">{t`Allow list (only these validators)`}</option>
          <option value="deny">{t`Deny list (every validator EXCEPT these)`}</option>
        </select>
      </div>

      {listMode !== 'any' && (
        <ValidatorPicker
          mode={listMode}
          selected={selected}
          onChange={(next) => form.setValue('validators', next, { shouldValidate: true })}
          validators={validators}
        />
      )}
      {form.formState.errors.validators && (
        <span className="text-xs text-destructive">
          {form.formState.errors.validators.message}
        </span>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// ValidatorPicker — chip-multi-select for Stake-grant allow/deny lists (M10.7)
// ---------------------------------------------------------------------------

interface ValidatorPickerProps {
  mode: 'allow' | 'deny'
  selected: readonly string[]
  onChange: (next: string[]) => void
  validators: readonly Validator[]
}

function ValidatorPicker({ mode, selected, onChange, validators }: ValidatorPickerProps) {
  const { t } = useLingui()
  const [search, setSearch] = useState('')

  const sorted = useMemo(() => sortValidators(validators), [validators])
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return sorted.slice(0, 20)
    return sorted
      .filter((v) => {
        const moniker = (v.description?.moniker ?? '').toLowerCase()
        return moniker.includes(q) || v.operatorAddress.toLowerCase().includes(q)
      })
      .slice(0, 20)
  }, [sorted, search])

  const monikerOf = (valoper: string): string => {
    const m = validators.find((v) => v.operatorAddress === valoper)?.description?.moniker
    return m && m.length > 0 ? m : `${valoper.slice(0, 12)}…${valoper.slice(-4)}`
  }

  const toggle = (valoper: string) => {
    if (selected.includes(valoper)) {
      onChange(selected.filter((v) => v !== valoper))
    } else {
      onChange([...selected, valoper])
    }
  }

  return (
    <div className="flex flex-col gap-1">
      {selected.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {selected.map((valoper) => (
            <button
              key={valoper}
              type="button"
              onClick={() => toggle(valoper)}
              className="inline-flex items-center gap-1 rounded border border-primary/40 bg-primary/5 px-1.5 py-0.5 text-[10px] hover:bg-primary/10"
              title={valoper}
            >
              <span className="font-medium">{monikerOf(valoper)}</span>
              <span className="text-muted-foreground">×</span>
            </button>
          ))}
        </div>
      ) : (
        <p className="text-[10px] italic text-muted-foreground">
          {mode === 'allow' ? (
            <Trans>No validators picked yet — pick at least one to continue.</Trans>
          ) : (
            <Trans>No validators picked — grant currently applies to every validator.</Trans>
          )}
        </p>
      )}
      <Input
        placeholder={t`Search by moniker or undvaloper1…`}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="font-mono"
      />
      <ul className="max-h-40 overflow-y-auto rounded border border-border bg-background/50">
        {filtered.length === 0 && (
          <li className="px-2 py-1 text-[10px] italic text-muted-foreground">
            <Trans>No matches.</Trans>
          </li>
        )}
        {filtered.map((v) => {
          const isSelected = selected.includes(v.operatorAddress)
          const moniker = v.description?.moniker ?? v.operatorAddress
          return (
            <li key={v.operatorAddress}>
              <button
                type="button"
                onClick={() => toggle(v.operatorAddress)}
                className={
                  'flex w-full items-center justify-between gap-2 border-b border-border px-2 py-1 text-left text-[11px] last:border-b-0 hover:bg-accent ' +
                  (isSelected ? 'bg-primary/5' : '')
                }
              >
                <span className="flex flex-col min-w-0">
                  <span className="truncate font-medium">{moniker}</span>
                  <span className="truncate font-mono text-[9px] text-muted-foreground">
                    {v.operatorAddress}
                  </span>
                </span>
                {isSelected && (
                  <span className="shrink-0 text-[9px] font-semibold uppercase tracking-wide text-primary">
                    <Trans>picked</Trans>
                  </span>
                )}
              </button>
            </li>
          )
        })}
      </ul>
      <span className="text-[10px] text-muted-foreground">
        {mode === 'allow' ? (
          <Trans>Grantee may only act on the {selected.length} picked validator(s).</Trans>
        ) : (
          <Trans>Grantee may act on every validator EXCEPT the {selected.length} picked.</Trans>
        )}
      </span>
    </div>
  )
}

interface GenericGrantFieldsProps {
  form: ReturnType<typeof useForm<GenericGrantFormValues>>
}

function GenericGrantFields({ form }: GenericGrantFieldsProps) {
  const { t } = useLingui()
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
