import { msg } from '@lingui/core/macro'
import { MsgExec, MsgGrant, MsgRevoke } from 'cosmjs-types/cosmos/authz/v1beta1/tx'
import { MsgMultiSend, MsgSend } from 'cosmjs-types/cosmos/bank/v1beta1/tx'
import {
  MsgFundCommunityPool,
  MsgSetWithdrawAddress,
  MsgWithdrawDelegatorReward,
  MsgWithdrawValidatorCommission,
} from 'cosmjs-types/cosmos/distribution/v1beta1/tx'
import { MsgSubmitEvidence } from 'cosmjs-types/cosmos/evidence/v1beta1/tx'
import {
  MsgGrantAllowance,
  MsgRevokeAllowance,
} from 'cosmjs-types/cosmos/feegrant/v1beta1/tx'
import { voteOptionToJSON } from 'cosmjs-types/cosmos/gov/v1/gov'
import {
  MsgCancelProposal,
  MsgDeposit as MsgDepositV1,
  MsgSubmitProposal as MsgSubmitProposalV1,
  MsgVote as MsgVoteV1,
  MsgVoteWeighted as MsgVoteWeightedV1,
} from 'cosmjs-types/cosmos/gov/v1/tx'
import {
  voteOptionToJSON as voteOptionToJSONV1Beta1,
} from 'cosmjs-types/cosmos/gov/v1beta1/gov'
import {
  MsgDeposit as MsgDepositV1Beta1,
  MsgSubmitProposal as MsgSubmitProposalV1Beta1,
  MsgVote as MsgVoteV1Beta1,
  MsgVoteWeighted as MsgVoteWeightedV1Beta1,
} from 'cosmjs-types/cosmos/gov/v1beta1/tx'
import { MsgUnjail } from 'cosmjs-types/cosmos/slashing/v1beta1/tx'
import {
  MsgBeginRedelegate,
  MsgCancelUnbondingDelegation,
  MsgCreateValidator,
  MsgDelegate,
  MsgEditValidator,
  MsgUndelegate,
} from 'cosmjs-types/cosmos/staking/v1beta1/tx'
import {
  MsgCancelUpgrade,
  MsgSoftwareUpgrade,
} from 'cosmjs-types/cosmos/upgrade/v1beta1/tx'
import {
  MsgCreatePeriodicVestingAccount,
  MsgCreatePermanentLockedAccount,
  MsgCreateVestingAccount,
} from 'cosmjs-types/cosmos/vesting/v1beta1/tx'
import { MsgTransfer } from 'cosmjs-types/ibc/applications/transfer/v1/tx'

import { i18n } from '@/lib/i18n'
import { nundToFund } from '@/lib/msgs/send'

// ---------------------------------------------------------------------------
// Module note — declarative tx-history presenter map
// ---------------------------------------------------------------------------
// Single source of truth for "given a Msg typeUrl + decoded body, what does
// it look like in tx history?". Each presenter is a pure function from
// `(rawBytes, ctx) → PresenterResult`. The render component (`<TxRow />`)
// only needs to look up by typeUrl + call the presenter; it doesn't carry
// per-Msg-type branching.
//
// Localisation: every user-facing string returned by a presenter goes
// through `i18n._(msg\`…\`)` — the lingui catalogue is the single source
// of UI text. Identifiers (addresses, denoms, type URLs) stay verbatim.
//
// Adding a new Msg type:
//   1. Import its proto type from cosmjs-types (or hand-decode if it lives
//      in a Unification module without a cosmjs-types binding).
//   2. Add a single entry to `PRESENTERS` keyed by typeUrl.
//   3. Return `{ verb, direction, items }` — labels translated, values raw
//      identifier strings (the renderer styles them).
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Tx direction relative to the active wallet account. */
export type TxDirection = 'sent' | 'received' | 'info'

export interface PresenterContext {
  /** Active wallet address — drives sent vs received inference. */
  address: string
}

export interface PresenterItem {
  /** Localised label, e.g. "From", "Amount", "Validator". */
  label: string
  /** Raw value (address, amount, hash, …). Already pre-formatted for display. */
  value: string
  /** Render in monospace font (default false). Addresses, amounts, hashes. */
  mono?: boolean
}

export interface PresenterResult {
  /** Localised one-word past-tense verb, e.g. "Sent", "Delegated", "Voted YES". */
  verb: string
  /** Direction badge. `info` for relayer / module-internal Msgs. */
  direction: TxDirection
  /** Optional structured detail items shown below the verb. */
  items: PresenterItem[]
}

export type Presenter = (rawBytes: Uint8Array, ctx: PresenterContext) => PresenterResult

// ---------------------------------------------------------------------------
// Helpers — used by many presenters
// ---------------------------------------------------------------------------

interface Coin {
  denom: string
  amount: string
}

/**
 * Render a `Coin[]` array as a single human-readable string. For `nund`
 * coins the amount is converted to FUND; other denoms surface raw.
 */
function formatCoins(coins: readonly Coin[] | undefined): string {
  if (!coins || coins.length === 0) return '—'
  return coins
    .map((c) => (c.denom === 'nund' ? `${nundToFund(c.amount)} FUND` : `${c.amount} ${c.denom}`))
    .join(', ')
}

/** Render a single `Coin` value. */
function formatCoin(coin: Coin | undefined): string {
  if (!coin) return '—'
  return coin.denom === 'nund' ? `${nundToFund(coin.amount)} FUND` : `${coin.amount} ${coin.denom}`
}

/**
 * Short-form a fully-qualified Msg typeUrl into just the trailing name.
 * `/cosmos.bank.v1beta1.MsgSend` → `MsgSend`. Used by the default branch
 * to surface unknown Msgs without flooding the UI with proto package prefix.
 */
export function shortTypeUrl(typeUrl: string): string {
  const last = typeUrl.split('.').pop()
  return last?.startsWith('Msg') ? last : typeUrl
}

/** Module name from a typeUrl. `/cosmos.bank.v1beta1.MsgSend` → `bank`. */
function moduleOf(typeUrl: string): string {
  // `/cosmos.bank.v1beta1.MsgSend` → split → ['', 'cosmos', 'bank', 'v1beta1', 'MsgSend']
  const parts = typeUrl.replace(/^\//, '').split('.')
  return parts[1] ?? typeUrl
}

// ---------------------------------------------------------------------------
// Bank
// ---------------------------------------------------------------------------

function presentMsgSend(raw: Uint8Array, ctx: PresenterContext): PresenterResult {
  const m = MsgSend.decode(raw)
  const sent = m.fromAddress === ctx.address
  return {
    verb: sent ? i18n._(msg`Sent`) : i18n._(msg`Received`),
    direction: sent ? 'sent' : 'received',
    items: [
      { label: i18n._(msg`From`), value: m.fromAddress, mono: true },
      { label: i18n._(msg`To`), value: m.toAddress, mono: true },
      { label: i18n._(msg`Amount`), value: formatCoins(m.amount), mono: true },
    ],
  }
}

function presentMsgMultiSend(raw: Uint8Array, ctx: PresenterContext): PresenterResult {
  const m = MsgMultiSend.decode(raw)
  const involvedAsInput = m.inputs.some((i) => i.address === ctx.address)
  const involvedAsOutput = m.outputs.some((o) => o.address === ctx.address)
  const total = m.inputs.reduce<Coin[]>((acc, i) => {
    for (const c of i.coins) {
      const existing = acc.find((a) => a.denom === c.denom)
      if (existing) existing.amount = (BigInt(existing.amount) + BigInt(c.amount)).toString()
      else acc.push({ ...c })
    }
    return acc
  }, [])
  return {
    verb: involvedAsInput ? i18n._(msg`Sent (multi)`) : i18n._(msg`Received (multi)`),
    direction: involvedAsInput ? 'sent' : involvedAsOutput ? 'received' : 'info',
    items: [
      { label: i18n._(msg`Inputs`), value: m.inputs.length.toString() },
      { label: i18n._(msg`Outputs`), value: m.outputs.length.toString() },
      { label: i18n._(msg`Total moved`), value: formatCoins(total), mono: true },
    ],
  }
}

// Staking -------------------------------------------------------------------

function presentMsgDelegate(raw: Uint8Array): PresenterResult {
  const m = MsgDelegate.decode(raw)
  return {
    verb: i18n._(msg`Delegated`),
    direction: 'sent',
    items: [
      { label: i18n._(msg`Validator`), value: m.validatorAddress, mono: true },
      { label: i18n._(msg`Amount`), value: formatCoin(m.amount), mono: true },
    ],
  }
}

function presentMsgUndelegate(raw: Uint8Array): PresenterResult {
  const m = MsgUndelegate.decode(raw)
  return {
    verb: i18n._(msg`Undelegated`),
    direction: 'sent',
    items: [
      { label: i18n._(msg`Validator`), value: m.validatorAddress, mono: true },
      { label: i18n._(msg`Amount`), value: formatCoin(m.amount), mono: true },
    ],
  }
}

function presentMsgBeginRedelegate(raw: Uint8Array): PresenterResult {
  const m = MsgBeginRedelegate.decode(raw)
  return {
    verb: i18n._(msg`Redelegated`),
    direction: 'sent',
    items: [
      { label: i18n._(msg`From validator`), value: m.validatorSrcAddress, mono: true },
      { label: i18n._(msg`To validator`), value: m.validatorDstAddress, mono: true },
      { label: i18n._(msg`Amount`), value: formatCoin(m.amount), mono: true },
    ],
  }
}

function presentMsgCancelUnbondingDelegation(raw: Uint8Array): PresenterResult {
  const m = MsgCancelUnbondingDelegation.decode(raw)
  return {
    verb: i18n._(msg`Cancelled unbonding`),
    direction: 'sent',
    items: [
      { label: i18n._(msg`Validator`), value: m.validatorAddress, mono: true },
      { label: i18n._(msg`Amount`), value: formatCoin(m.amount), mono: true },
      { label: i18n._(msg`Creation height`), value: m.creationHeight.toString(), mono: true },
    ],
  }
}

function presentMsgCreateValidator(raw: Uint8Array): PresenterResult {
  const m = MsgCreateValidator.decode(raw)
  return {
    verb: i18n._(msg`Created validator`),
    direction: 'sent',
    items: [
      { label: i18n._(msg`Moniker`), value: m.description?.moniker || '—' },
      { label: i18n._(msg`Operator`), value: m.validatorAddress, mono: true },
      { label: i18n._(msg`Self-bond`), value: formatCoin(m.value), mono: true },
    ],
  }
}

function presentMsgEditValidator(raw: Uint8Array): PresenterResult {
  const m = MsgEditValidator.decode(raw)
  return {
    verb: i18n._(msg`Edited validator`),
    direction: 'sent',
    items: [
      { label: i18n._(msg`Operator`), value: m.validatorAddress, mono: true },
      { label: i18n._(msg`Moniker`), value: m.description?.moniker || '—' },
    ],
  }
}

// Distribution --------------------------------------------------------------

function presentMsgWithdrawDelegatorReward(raw: Uint8Array): PresenterResult {
  const m = MsgWithdrawDelegatorReward.decode(raw)
  return {
    verb: i18n._(msg`Withdrew rewards`),
    direction: 'sent',
    items: [{ label: i18n._(msg`Validator`), value: m.validatorAddress, mono: true }],
  }
}

function presentMsgWithdrawValidatorCommission(raw: Uint8Array): PresenterResult {
  const m = MsgWithdrawValidatorCommission.decode(raw)
  return {
    verb: i18n._(msg`Withdrew commission`),
    direction: 'sent',
    items: [{ label: i18n._(msg`Validator`), value: m.validatorAddress, mono: true }],
  }
}

function presentMsgSetWithdrawAddress(raw: Uint8Array): PresenterResult {
  const m = MsgSetWithdrawAddress.decode(raw)
  return {
    verb: i18n._(msg`Set withdraw address`),
    direction: 'sent',
    items: [
      { label: i18n._(msg`Delegator`), value: m.delegatorAddress, mono: true },
      { label: i18n._(msg`Withdraw address`), value: m.withdrawAddress, mono: true },
    ],
  }
}

function presentMsgFundCommunityPool(raw: Uint8Array): PresenterResult {
  const m = MsgFundCommunityPool.decode(raw)
  return {
    verb: i18n._(msg`Funded community pool`),
    direction: 'sent',
    items: [{ label: i18n._(msg`Amount`), value: formatCoins(m.amount), mono: true }],
  }
}

// Governance v1 -------------------------------------------------------------

function voteOptionLabelV1(option: number): string {
  // Map proto enum int back to a short translated label.
  switch (voteOptionToJSON(option)) {
    case 'VOTE_OPTION_YES':
      return i18n._(msg`YES`)
    case 'VOTE_OPTION_NO':
      return i18n._(msg`NO`)
    case 'VOTE_OPTION_ABSTAIN':
      return i18n._(msg`ABSTAIN`)
    case 'VOTE_OPTION_NO_WITH_VETO':
      return i18n._(msg`VETO`)
    default:
      return '—'
  }
}

function voteOptionLabelV1Beta1(option: number): string {
  switch (voteOptionToJSONV1Beta1(option)) {
    case 'VOTE_OPTION_YES':
      return i18n._(msg`YES`)
    case 'VOTE_OPTION_NO':
      return i18n._(msg`NO`)
    case 'VOTE_OPTION_ABSTAIN':
      return i18n._(msg`ABSTAIN`)
    case 'VOTE_OPTION_NO_WITH_VETO':
      return i18n._(msg`VETO`)
    default:
      return '—'
  }
}

function presentMsgVoteV1(raw: Uint8Array): PresenterResult {
  const m = MsgVoteV1.decode(raw)
  return {
    verb: i18n._(msg`Voted ${voteOptionLabelV1(m.option)}`),
    direction: 'sent',
    items: [
      { label: i18n._(msg`Proposal`), value: `#${m.proposalId.toString()}`, mono: true },
    ],
  }
}

function presentMsgVoteWeightedV1(raw: Uint8Array): PresenterResult {
  const m = MsgVoteWeightedV1.decode(raw)
  return {
    verb: i18n._(msg`Voted (weighted)`),
    direction: 'sent',
    items: [
      { label: i18n._(msg`Proposal`), value: `#${m.proposalId.toString()}`, mono: true },
      { label: i18n._(msg`Splits`), value: m.options.length.toString() },
    ],
  }
}

function presentMsgDepositV1(raw: Uint8Array): PresenterResult {
  const m = MsgDepositV1.decode(raw)
  return {
    verb: i18n._(msg`Deposited to proposal`),
    direction: 'sent',
    items: [
      { label: i18n._(msg`Proposal`), value: `#${m.proposalId.toString()}`, mono: true },
      { label: i18n._(msg`Amount`), value: formatCoins(m.amount), mono: true },
    ],
  }
}

function presentMsgSubmitProposalV1(raw: Uint8Array): PresenterResult {
  const m = MsgSubmitProposalV1.decode(raw)
  return {
    verb: i18n._(msg`Submitted proposal`),
    direction: 'sent',
    items: [
      { label: i18n._(msg`Title`), value: m.title || '—' },
      { label: i18n._(msg`Messages`), value: m.messages.length.toString() },
      { label: i18n._(msg`Initial deposit`), value: formatCoins(m.initialDeposit), mono: true },
      { label: i18n._(msg`Proposer`), value: m.proposer, mono: true },
    ],
  }
}

function presentMsgCancelProposal(raw: Uint8Array): PresenterResult {
  const m = MsgCancelProposal.decode(raw)
  return {
    verb: i18n._(msg`Cancelled proposal`),
    direction: 'sent',
    items: [
      { label: i18n._(msg`Proposal`), value: `#${m.proposalId.toString()}`, mono: true },
      { label: i18n._(msg`Proposer`), value: m.proposer, mono: true },
    ],
  }
}

// Governance v1beta1 (historical txs) ---------------------------------------

function presentMsgVoteV1Beta1(raw: Uint8Array): PresenterResult {
  const m = MsgVoteV1Beta1.decode(raw)
  return {
    verb: i18n._(msg`Voted ${voteOptionLabelV1Beta1(m.option)}`),
    direction: 'sent',
    items: [
      { label: i18n._(msg`Proposal`), value: `#${m.proposalId.toString()}`, mono: true },
    ],
  }
}

function presentMsgVoteWeightedV1Beta1(raw: Uint8Array): PresenterResult {
  const m = MsgVoteWeightedV1Beta1.decode(raw)
  return {
    verb: i18n._(msg`Voted (weighted)`),
    direction: 'sent',
    items: [
      { label: i18n._(msg`Proposal`), value: `#${m.proposalId.toString()}`, mono: true },
      { label: i18n._(msg`Splits`), value: m.options.length.toString() },
    ],
  }
}

function presentMsgDepositV1Beta1(raw: Uint8Array): PresenterResult {
  const m = MsgDepositV1Beta1.decode(raw)
  return {
    verb: i18n._(msg`Deposited to proposal`),
    direction: 'sent',
    items: [
      { label: i18n._(msg`Proposal`), value: `#${m.proposalId.toString()}`, mono: true },
      { label: i18n._(msg`Amount`), value: formatCoins(m.amount), mono: true },
    ],
  }
}

function presentMsgSubmitProposalV1Beta1(raw: Uint8Array): PresenterResult {
  const m = MsgSubmitProposalV1Beta1.decode(raw)
  return {
    verb: i18n._(msg`Submitted proposal`),
    direction: 'sent',
    items: [
      {
        label: i18n._(msg`Content`),
        value: m.content ? shortTypeUrl(m.content.typeUrl) : '—',
        mono: true,
      },
      { label: i18n._(msg`Initial deposit`), value: formatCoins(m.initialDeposit), mono: true },
      { label: i18n._(msg`Proposer`), value: m.proposer, mono: true },
    ],
  }
}

// Authz ---------------------------------------------------------------------

function presentMsgGrant(raw: Uint8Array, ctx: PresenterContext): PresenterResult {
  const m = MsgGrant.decode(raw)
  const isGrantee = m.grantee === ctx.address
  return {
    verb: isGrantee ? i18n._(msg`Granted authz (received)`) : i18n._(msg`Granted authz`),
    direction: isGrantee ? 'received' : 'sent',
    items: [
      { label: i18n._(msg`Granter`), value: m.granter, mono: true },
      { label: i18n._(msg`Grantee`), value: m.grantee, mono: true },
      {
        label: i18n._(msg`Authorisation`),
        value: m.grant?.authorization ? shortTypeUrl(m.grant.authorization.typeUrl) : '—',
        mono: true,
      },
    ],
  }
}

function presentMsgRevoke(raw: Uint8Array, ctx: PresenterContext): PresenterResult {
  const m = MsgRevoke.decode(raw)
  const isGrantee = m.grantee === ctx.address
  return {
    verb: i18n._(msg`Revoked authz`),
    direction: isGrantee ? 'received' : 'sent',
    items: [
      { label: i18n._(msg`Granter`), value: m.granter, mono: true },
      { label: i18n._(msg`Grantee`), value: m.grantee, mono: true },
      { label: i18n._(msg`Msg type`), value: m.msgTypeUrl, mono: true },
    ],
  }
}

function presentMsgExec(raw: Uint8Array, ctx: PresenterContext): PresenterResult {
  const m = MsgExec.decode(raw)
  const isGrantee = m.grantee === ctx.address
  const innerTypes = Array.from(new Set(m.msgs.map((a) => shortTypeUrl(a.typeUrl))))
  return {
    verb: i18n._(msg`Executed authz`),
    direction: isGrantee ? 'sent' : 'info',
    items: [
      { label: i18n._(msg`Grantee`), value: m.grantee, mono: true },
      { label: i18n._(msg`Inner Msgs`), value: innerTypes.join(', ') || '—', mono: true },
      { label: i18n._(msg`Count`), value: m.msgs.length.toString() },
    ],
  }
}

// Feegrant ------------------------------------------------------------------

function presentMsgGrantAllowance(raw: Uint8Array, ctx: PresenterContext): PresenterResult {
  const m = MsgGrantAllowance.decode(raw)
  const isGrantee = m.grantee === ctx.address
  return {
    verb: i18n._(msg`Granted fee allowance`),
    direction: isGrantee ? 'received' : 'sent',
    items: [
      { label: i18n._(msg`Granter`), value: m.granter, mono: true },
      { label: i18n._(msg`Grantee`), value: m.grantee, mono: true },
      {
        label: i18n._(msg`Allowance`),
        value: m.allowance ? shortTypeUrl(m.allowance.typeUrl) : '—',
        mono: true,
      },
    ],
  }
}

function presentMsgRevokeAllowance(raw: Uint8Array, ctx: PresenterContext): PresenterResult {
  const m = MsgRevokeAllowance.decode(raw)
  const isGrantee = m.grantee === ctx.address
  return {
    verb: i18n._(msg`Revoked fee allowance`),
    direction: isGrantee ? 'received' : 'sent',
    items: [
      { label: i18n._(msg`Granter`), value: m.granter, mono: true },
      { label: i18n._(msg`Grantee`), value: m.grantee, mono: true },
    ],
  }
}

// IBC transfer (writer side) ------------------------------------------------

function presentMsgTransfer(raw: Uint8Array, ctx: PresenterContext): PresenterResult {
  const m = MsgTransfer.decode(raw)
  const isSender = m.sender === ctx.address
  return {
    verb: isSender ? i18n._(msg`Sent via IBC`) : i18n._(msg`Received via IBC`),
    direction: isSender ? 'sent' : 'received',
    items: [
      { label: i18n._(msg`Channel`), value: `${m.sourcePort}/${m.sourceChannel}`, mono: true },
      { label: i18n._(msg`From`), value: m.sender, mono: true },
      { label: i18n._(msg`To`), value: m.receiver, mono: true },
      { label: i18n._(msg`Amount`), value: m.token ? formatCoin(m.token) : '—', mono: true },
      ...(m.memo
        ? [{ label: i18n._(msg`Memo`), value: m.memo }]
        : []),
    ],
  }
}

// Slashing ------------------------------------------------------------------

function presentMsgUnjail(raw: Uint8Array): PresenterResult {
  const m = MsgUnjail.decode(raw)
  return {
    verb: i18n._(msg`Unjailed validator`),
    direction: 'sent',
    items: [{ label: i18n._(msg`Validator`), value: m.validatorAddr, mono: true }],
  }
}

// Evidence ------------------------------------------------------------------

function presentMsgSubmitEvidence(raw: Uint8Array): PresenterResult {
  const m = MsgSubmitEvidence.decode(raw)
  return {
    verb: i18n._(msg`Submitted evidence`),
    direction: 'sent',
    items: [
      { label: i18n._(msg`Submitter`), value: m.submitter, mono: true },
      {
        label: i18n._(msg`Evidence type`),
        value: m.evidence ? shortTypeUrl(m.evidence.typeUrl) : '—',
        mono: true,
      },
    ],
  }
}

// Upgrade (gov-only) --------------------------------------------------------

function presentMsgSoftwareUpgrade(raw: Uint8Array): PresenterResult {
  const m = MsgSoftwareUpgrade.decode(raw)
  return {
    verb: i18n._(msg`Scheduled upgrade`),
    direction: 'info',
    items: [
      { label: i18n._(msg`Name`), value: m.plan?.name || '—', mono: true },
      { label: i18n._(msg`Height`), value: m.plan?.height?.toString() ?? '—', mono: true },
    ],
  }
}

function presentMsgCancelUpgrade(raw: Uint8Array): PresenterResult {
  const m = MsgCancelUpgrade.decode(raw)
  return {
    verb: i18n._(msg`Cancelled upgrade`),
    direction: 'info',
    items: [{ label: i18n._(msg`Authority`), value: m.authority, mono: true }],
  }
}

// Vesting -------------------------------------------------------------------

function presentMsgCreateVestingAccount(raw: Uint8Array, ctx: PresenterContext): PresenterResult {
  const m = MsgCreateVestingAccount.decode(raw)
  const isFromCtx = m.fromAddress === ctx.address
  return {
    verb: i18n._(msg`Created vesting account`),
    direction: isFromCtx ? 'sent' : m.toAddress === ctx.address ? 'received' : 'info',
    items: [
      { label: i18n._(msg`From`), value: m.fromAddress, mono: true },
      { label: i18n._(msg`To`), value: m.toAddress, mono: true },
      { label: i18n._(msg`Amount`), value: formatCoins(m.amount), mono: true },
      { label: i18n._(msg`End time`), value: m.endTime.toString(), mono: true },
    ],
  }
}

function presentMsgCreatePeriodicVestingAccount(
  raw: Uint8Array,
  ctx: PresenterContext,
): PresenterResult {
  const m = MsgCreatePeriodicVestingAccount.decode(raw)
  const isFromCtx = m.fromAddress === ctx.address
  return {
    verb: i18n._(msg`Created periodic vesting account`),
    direction: isFromCtx ? 'sent' : m.toAddress === ctx.address ? 'received' : 'info',
    items: [
      { label: i18n._(msg`From`), value: m.fromAddress, mono: true },
      { label: i18n._(msg`To`), value: m.toAddress, mono: true },
      { label: i18n._(msg`Periods`), value: m.vestingPeriods.length.toString() },
    ],
  }
}

function presentMsgCreatePermanentLockedAccount(
  raw: Uint8Array,
  ctx: PresenterContext,
): PresenterResult {
  const m = MsgCreatePermanentLockedAccount.decode(raw)
  const isFromCtx = m.fromAddress === ctx.address
  return {
    verb: i18n._(msg`Created permanent-locked account`),
    direction: isFromCtx ? 'sent' : m.toAddress === ctx.address ? 'received' : 'info',
    items: [
      { label: i18n._(msg`From`), value: m.fromAddress, mono: true },
      { label: i18n._(msg`To`), value: m.toAddress, mono: true },
      { label: i18n._(msg`Amount`), value: formatCoins(m.amount), mono: true },
    ],
  }
}

// ---------------------------------------------------------------------------
// Generic "info-only" presenter — used for module-internal Msgs that affect
// global state but don't relate to the user's own activity directly. Renders
// just the short typeUrl with no body decoding.
// ---------------------------------------------------------------------------

function presentInfoOnly(typeUrl: string): Presenter {
  const short = shortTypeUrl(typeUrl)
  const module = moduleOf(typeUrl)
  return () => ({
    verb: i18n._(msg`${module}: ${short}`),
    direction: 'info',
    items: [],
  })
}

// ---------------------------------------------------------------------------
// Unification module presenters — fundjs-react proto bindings don't tree-shake
// under linked Rollup (see staking.ts module note). For the first-cut M4 we
// render the short typeUrl + an `info` badge. The chain emits structured
// events for these Msgs (in the `IndexedTx.events[]`) — a follow-up commit
// can surface event-level details (e.g. beacon-id, stream-id, deposit
// amount) without needing the proto decoder. Tracked at M4.2 close-out.
// ---------------------------------------------------------------------------

/**
 * First-cut Unification-Msg renderer — short typeUrl + `sent` badge (since
 * the user is necessarily the signer of any tx in their own history). A
 * follow-up commit can surface chain-emitted event attributes (beacon-id,
 * stream-id, deposit amount, …) without needing the fundjs-react proto
 * decoder. Tracked at M4 close.
 */
function presentUnificationMsg(typeUrl: string): PresenterResult {
  return {
    verb: shortTypeUrl(typeUrl),
    direction: 'sent',
    items: [],
  }
}

// ---------------------------------------------------------------------------
// Default fallback — unknown typeUrl. Surface just the short name + module.
// ---------------------------------------------------------------------------

export function presentUnknown(typeUrl: string): PresenterResult {
  return {
    verb: shortTypeUrl(typeUrl),
    direction: 'info',
    items: [{ label: i18n._(msg`Module`), value: moduleOf(typeUrl), mono: true }],
  }
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const PRESENTERS: Record<string, Presenter> = {
  // Bank
  '/cosmos.bank.v1beta1.MsgSend': presentMsgSend,
  '/cosmos.bank.v1beta1.MsgMultiSend': presentMsgMultiSend,
  '/cosmos.bank.v1beta1.MsgUpdateParams': presentInfoOnly('/cosmos.bank.v1beta1.MsgUpdateParams'),

  // Staking
  '/cosmos.staking.v1beta1.MsgDelegate': presentMsgDelegate,
  '/cosmos.staking.v1beta1.MsgUndelegate': presentMsgUndelegate,
  '/cosmos.staking.v1beta1.MsgBeginRedelegate': presentMsgBeginRedelegate,
  '/cosmos.staking.v1beta1.MsgCancelUnbondingDelegation': presentMsgCancelUnbondingDelegation,
  '/cosmos.staking.v1beta1.MsgCreateValidator': presentMsgCreateValidator,
  '/cosmos.staking.v1beta1.MsgEditValidator': presentMsgEditValidator,
  '/cosmos.staking.v1beta1.MsgUpdateParams': presentInfoOnly(
    '/cosmos.staking.v1beta1.MsgUpdateParams',
  ),

  // Distribution
  '/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward': presentMsgWithdrawDelegatorReward,
  '/cosmos.distribution.v1beta1.MsgWithdrawValidatorCommission':
    presentMsgWithdrawValidatorCommission,
  '/cosmos.distribution.v1beta1.MsgSetWithdrawAddress': presentMsgSetWithdrawAddress,
  '/cosmos.distribution.v1beta1.MsgFundCommunityPool': presentMsgFundCommunityPool,
  '/cosmos.distribution.v1beta1.MsgCommunityPoolSpend': presentInfoOnly(
    '/cosmos.distribution.v1beta1.MsgCommunityPoolSpend',
  ),
  '/cosmos.distribution.v1beta1.MsgDepositValidatorRewardsPool': presentInfoOnly(
    '/cosmos.distribution.v1beta1.MsgDepositValidatorRewardsPool',
  ),
  '/cosmos.distribution.v1beta1.MsgUpdateParams': presentInfoOnly(
    '/cosmos.distribution.v1beta1.MsgUpdateParams',
  ),

  // Gov v1
  '/cosmos.gov.v1.MsgVote': presentMsgVoteV1,
  '/cosmos.gov.v1.MsgVoteWeighted': presentMsgVoteWeightedV1,
  '/cosmos.gov.v1.MsgDeposit': presentMsgDepositV1,
  '/cosmos.gov.v1.MsgSubmitProposal': presentMsgSubmitProposalV1,
  '/cosmos.gov.v1.MsgCancelProposal': presentMsgCancelProposal,
  '/cosmos.gov.v1.MsgExecLegacyContent': presentInfoOnly('/cosmos.gov.v1.MsgExecLegacyContent'),
  '/cosmos.gov.v1.MsgUpdateParams': presentInfoOnly('/cosmos.gov.v1.MsgUpdateParams'),

  // Gov v1beta1 (historical)
  '/cosmos.gov.v1beta1.MsgVote': presentMsgVoteV1Beta1,
  '/cosmos.gov.v1beta1.MsgVoteWeighted': presentMsgVoteWeightedV1Beta1,
  '/cosmos.gov.v1beta1.MsgDeposit': presentMsgDepositV1Beta1,
  '/cosmos.gov.v1beta1.MsgSubmitProposal': presentMsgSubmitProposalV1Beta1,

  // Authz
  '/cosmos.authz.v1beta1.MsgGrant': presentMsgGrant,
  '/cosmos.authz.v1beta1.MsgRevoke': presentMsgRevoke,
  '/cosmos.authz.v1beta1.MsgExec': presentMsgExec,

  // Feegrant
  '/cosmos.feegrant.v1beta1.MsgGrantAllowance': presentMsgGrantAllowance,
  '/cosmos.feegrant.v1beta1.MsgRevokeAllowance': presentMsgRevokeAllowance,

  // IBC transfer (writer side)
  '/ibc.applications.transfer.v1.MsgTransfer': presentMsgTransfer,

  // IBC core (relayer infrastructure — info-only)
  '/ibc.core.client.v1.MsgCreateClient': presentInfoOnly('/ibc.core.client.v1.MsgCreateClient'),
  '/ibc.core.client.v1.MsgUpdateClient': presentInfoOnly('/ibc.core.client.v1.MsgUpdateClient'),
  '/ibc.core.client.v1.MsgUpgradeClient': presentInfoOnly('/ibc.core.client.v1.MsgUpgradeClient'),
  '/ibc.core.client.v1.MsgSubmitMisbehaviour': presentInfoOnly(
    '/ibc.core.client.v1.MsgSubmitMisbehaviour',
  ),
  '/ibc.core.connection.v1.MsgConnectionOpenInit': presentInfoOnly(
    '/ibc.core.connection.v1.MsgConnectionOpenInit',
  ),
  '/ibc.core.connection.v1.MsgConnectionOpenTry': presentInfoOnly(
    '/ibc.core.connection.v1.MsgConnectionOpenTry',
  ),
  '/ibc.core.connection.v1.MsgConnectionOpenAck': presentInfoOnly(
    '/ibc.core.connection.v1.MsgConnectionOpenAck',
  ),
  '/ibc.core.connection.v1.MsgConnectionOpenConfirm': presentInfoOnly(
    '/ibc.core.connection.v1.MsgConnectionOpenConfirm',
  ),
  '/ibc.core.channel.v1.MsgChannelOpenInit': presentInfoOnly(
    '/ibc.core.channel.v1.MsgChannelOpenInit',
  ),
  '/ibc.core.channel.v1.MsgChannelOpenTry': presentInfoOnly(
    '/ibc.core.channel.v1.MsgChannelOpenTry',
  ),
  '/ibc.core.channel.v1.MsgChannelOpenAck': presentInfoOnly(
    '/ibc.core.channel.v1.MsgChannelOpenAck',
  ),
  '/ibc.core.channel.v1.MsgChannelOpenConfirm': presentInfoOnly(
    '/ibc.core.channel.v1.MsgChannelOpenConfirm',
  ),
  '/ibc.core.channel.v1.MsgChannelCloseInit': presentInfoOnly(
    '/ibc.core.channel.v1.MsgChannelCloseInit',
  ),
  '/ibc.core.channel.v1.MsgChannelCloseConfirm': presentInfoOnly(
    '/ibc.core.channel.v1.MsgChannelCloseConfirm',
  ),
  '/ibc.core.channel.v1.MsgRecvPacket': presentInfoOnly('/ibc.core.channel.v1.MsgRecvPacket'),
  '/ibc.core.channel.v1.MsgAcknowledgement': presentInfoOnly(
    '/ibc.core.channel.v1.MsgAcknowledgement',
  ),
  '/ibc.core.channel.v1.MsgTimeout': presentInfoOnly('/ibc.core.channel.v1.MsgTimeout'),
  '/ibc.core.channel.v1.MsgTimeoutOnClose': presentInfoOnly(
    '/ibc.core.channel.v1.MsgTimeoutOnClose',
  ),

  // Slashing
  '/cosmos.slashing.v1beta1.MsgUnjail': presentMsgUnjail,
  '/cosmos.slashing.v1beta1.MsgUpdateParams': presentInfoOnly(
    '/cosmos.slashing.v1beta1.MsgUpdateParams',
  ),

  // Evidence
  '/cosmos.evidence.v1beta1.MsgSubmitEvidence': presentMsgSubmitEvidence,

  // Vesting
  '/cosmos.vesting.v1beta1.MsgCreateVestingAccount': presentMsgCreateVestingAccount,
  '/cosmos.vesting.v1beta1.MsgCreatePeriodicVestingAccount':
    presentMsgCreatePeriodicVestingAccount,
  '/cosmos.vesting.v1beta1.MsgCreatePermanentLockedAccount':
    presentMsgCreatePermanentLockedAccount,
  // Vesting clawback variants are SDK 0.50+ and not part of v0.54 mainchain
  // wiring — surfaced as info-only if they appear via IBC or future modules.
  '/cosmos.vesting.v1beta1.MsgCreateClawbackVestingAccount': presentInfoOnly(
    '/cosmos.vesting.v1beta1.MsgCreateClawbackVestingAccount',
  ),
  '/cosmos.vesting.v1beta1.MsgClawback': presentInfoOnly('/cosmos.vesting.v1beta1.MsgClawback'),

  // Crisis (info-only — gov-only writes)
  '/cosmos.crisis.v1beta1.MsgVerifyInvariant': presentInfoOnly(
    '/cosmos.crisis.v1beta1.MsgVerifyInvariant',
  ),
  '/cosmos.crisis.v1beta1.MsgUpdateParams': presentInfoOnly(
    '/cosmos.crisis.v1beta1.MsgUpdateParams',
  ),

  // Upgrade (gov-only)
  '/cosmos.upgrade.v1beta1.MsgSoftwareUpgrade': presentMsgSoftwareUpgrade,
  '/cosmos.upgrade.v1beta1.MsgCancelUpgrade': presentMsgCancelUpgrade,

  // Consensus (gov-only)
  '/cosmos.consensus.v1.MsgUpdateParams': presentInfoOnly('/cosmos.consensus.v1.MsgUpdateParams'),

  // Mint (gov-only)
  '/cosmos.mint.v1beta1.MsgUpdateParams': presentInfoOnly('/cosmos.mint.v1beta1.MsgUpdateParams'),
}

// ---------------------------------------------------------------------------
// Unification module presenter wiring — see comment above on why these
// fall back to short-typeUrl rendering rather than fully-decoded bodies.
// Listed in PRESENTERS so the default-branch JSON-dump fallback isn't used
// (avoids surfacing raw proto bytes for known module messages).
// ---------------------------------------------------------------------------

const UNIFICATION_MSG_TYPEURLS = [
  // beacon
  '/mainchain.beacon.v1.MsgRegisterBeacon',
  '/mainchain.beacon.v1.MsgRecordBeaconTimestamp',
  '/mainchain.beacon.v1.MsgPurchaseBeaconStateStorage',
  // wrkchain
  '/mainchain.wrkchain.v1.MsgRegisterWrkChain',
  '/mainchain.wrkchain.v1.MsgRecordWrkChainBlock',
  '/mainchain.wrkchain.v1.MsgPurchaseWrkChainStateStorage',
  // enterprise
  '/mainchain.enterprise.v1.MsgUndPurchaseOrder',
  '/mainchain.enterprise.v1.MsgProcessUndPurchaseOrder',
  '/mainchain.enterprise.v1.MsgWhitelistAddress',
  '/mainchain.enterprise.v1.MsgUnwhitelistAddress',
  // stream
  '/mainchain.stream.v1.MsgCreateStream',
  '/mainchain.stream.v1.MsgClaimStream',
  '/mainchain.stream.v1.MsgTopUpDeposit',
  '/mainchain.stream.v1.MsgUpdateFlowRate',
  '/mainchain.stream.v1.MsgCancelStream',
  '/mainchain.stream.v1.MsgUpdateParams',
] as const

for (const typeUrl of UNIFICATION_MSG_TYPEURLS) {
  PRESENTERS[typeUrl] = () => presentUnificationMsg(typeUrl)
}

// ---------------------------------------------------------------------------
// Public entry — typeUrl → presenter, with default-branch fallback.
// ---------------------------------------------------------------------------

/**
 * Resolve a Msg `Any` to a `PresenterResult`. Routes via the registry +
 * the default-branch fallback for unknown typeUrls. Catches decode failures
 * — a malformed Msg shouldn't crash the entire tx-history view.
 */
export function presentMsg(
  any: { typeUrl: string; value: Uint8Array },
  ctx: PresenterContext,
): PresenterResult {
  const presenter = PRESENTERS[any.typeUrl]
  if (!presenter) return presentUnknown(any.typeUrl)
  try {
    return presenter(any.value, ctx)
  } catch (err) {
    // Defensive — if a proto decode fails (corrupted wire, library mismatch)
    // the tx row should still surface SOMETHING readable rather than blank.
    console.error('[presenters] decode failed for', any.typeUrl, err)
    return presentUnknown(any.typeUrl)
  }
}

