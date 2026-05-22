import { type EncodeObject } from '@cosmjs/proto-signing'
import { z } from 'zod'

import { fundToNund } from './send'

/**
 * Minimum recommended balance to leave behind after a delegate so the user
 * can pay future gas (claim rewards, undelegate, etc.). Ported from
 * `OLD_VUE/src/constants.js:RECOMMENDED_MIN_BALANCE` — 60,000,000 nund =
 * 0.06 FUND. The Delegate form surfaces a warning (not a hard block) when
 * the post-delegate balance would fall below this threshold.
 */
export const RECOMMENDED_MIN_BALANCE_NUND = 60_000_000n

/**
 * Validator operator-address prefix on Unification. Different from the
 * account bech32 prefix (`und1`); staking Msgs need the `undvaloper1` form.
 */
const VALIDATOR_BECH32_RE = /^undvaloper1[a-z0-9]{38,58}$/

/** Delegate form — shared by M2.2 (Delegate) and a few M2.3 actions. */
export const DelegateFormSchema = z.object({
  validatorAddress: z
    .string()
    .regex(VALIDATOR_BECH32_RE, 'recipient must be a valid undvaloper1… validator address'),
  amountFund: z
    .string()
    .regex(/^\d+(\.\d+)?$/, 'amount must be a positive decimal'),
  denom: z.string().default('nund'),
  memo: z.string().max(256).optional(),
})

export type DelegateFormValues = z.infer<typeof DelegateFormSchema>

/**
 * Build a `MsgDelegate` EncodeObject. cosmjs's `SigningStargateClient`
 * registers this typeUrl by default, so no extra registry plumbing needed
 * in `useSubmitTx`.
 */
export function buildMsgDelegate(params: {
  delegatorAddress: string
  validatorAddress: string
  amountFund: string
  denom: string
}): EncodeObject {
  return {
    typeUrl: '/cosmos.staking.v1beta1.MsgDelegate',
    value: {
      delegatorAddress: params.delegatorAddress,
      validatorAddress: params.validatorAddress,
      amount: {
        denom: params.denom,
        amount: fundToNund(params.amountFund),
      },
    },
  }
}

/**
 * Default fee for delegate / undelegate / redelegate / withdraw Txs. Gas
 * budget set with ~40% headroom over the observed worst-case (redelegate
 * landed at 250764 gas during 2026-05-22 smoke — same-validator hand-off
 * to a new track plus updating two delegation records is the most
 * expensive single-Msg staking op). Fee amount stays well over the
 * chain's `25nund/gas` minimum-gas-prices floor. Gas estimation +
 * advanced user-override accordion is a backlog item (see SESSION_HANDOFF).
 */
export const DEFAULT_STAKING_FEE = {
  amount: [{ denom: 'nund', amount: '25000000' }],
  gas: '350000',
}

// ---------------------------------------------------------------------------
// Undelegate
// ---------------------------------------------------------------------------

export const UndelegateFormSchema = z.object({
  validatorAddress: z
    .string()
    .regex(VALIDATOR_BECH32_RE, 'validator must be a valid undvaloper1… address'),
  amountFund: z
    .string()
    .regex(/^\d+(\.\d+)?$/, 'amount must be a positive decimal'),
  denom: z.string().default('nund'),
  memo: z.string().max(256).optional(),
})

export type UndelegateFormValues = z.infer<typeof UndelegateFormSchema>

/** Build a `MsgUndelegate` EncodeObject. */
export function buildMsgUndelegate(params: {
  delegatorAddress: string
  validatorAddress: string
  amountFund: string
  denom: string
}): EncodeObject {
  return {
    typeUrl: '/cosmos.staking.v1beta1.MsgUndelegate',
    value: {
      delegatorAddress: params.delegatorAddress,
      validatorAddress: params.validatorAddress,
      amount: {
        denom: params.denom,
        amount: fundToNund(params.amountFund),
      },
    },
  }
}

// ---------------------------------------------------------------------------
// Redelegate (begin redelegation from one validator to another)
// ---------------------------------------------------------------------------

export const RedelegateFormSchema = z.object({
  srcValidatorAddress: z
    .string()
    .regex(VALIDATOR_BECH32_RE, 'source validator must be a valid undvaloper1… address'),
  dstValidatorAddress: z
    .string()
    .regex(VALIDATOR_BECH32_RE, 'destination validator must be a valid undvaloper1… address'),
  amountFund: z
    .string()
    .regex(/^\d+(\.\d+)?$/, 'amount must be a positive decimal'),
  denom: z.string().default('nund'),
  memo: z.string().max(256).optional(),
}).refine((data) => data.srcValidatorAddress !== data.dstValidatorAddress, {
  message: 'source and destination validators must differ',
  path: ['dstValidatorAddress'],
})

export type RedelegateFormValues = z.infer<typeof RedelegateFormSchema>

/** Build a `MsgBeginRedelegate` EncodeObject. */
export function buildMsgBeginRedelegate(params: {
  delegatorAddress: string
  srcValidatorAddress: string
  dstValidatorAddress: string
  amountFund: string
  denom: string
}): EncodeObject {
  return {
    typeUrl: '/cosmos.staking.v1beta1.MsgBeginRedelegate',
    value: {
      delegatorAddress: params.delegatorAddress,
      validatorSrcAddress: params.srcValidatorAddress,
      validatorDstAddress: params.dstValidatorAddress,
      amount: {
        denom: params.denom,
        amount: fundToNund(params.amountFund),
      },
    },
  }
}

// ---------------------------------------------------------------------------
// Withdraw delegator rewards (one Msg per validator)
// ---------------------------------------------------------------------------

/** Build a `MsgWithdrawDelegatorReward` EncodeObject. */
export function buildMsgWithdrawDelegatorReward(params: {
  delegatorAddress: string
  validatorAddress: string
}): EncodeObject {
  return {
    typeUrl: '/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward',
    value: {
      delegatorAddress: params.delegatorAddress,
      validatorAddress: params.validatorAddress,
    },
  }
}

/**
 * Build a multi-Msg `withdraw all rewards` payload — one
 * `MsgWithdrawDelegatorReward` per validator the user is delegating to.
 * Submitted as a single transaction; gas scales linearly so a delegator
 * with many positions needs a higher gas cap (handled in the UI via a
 * dynamic fee multiplier).
 */
export function buildMsgsWithdrawAllRewards(params: {
  delegatorAddress: string
  validatorAddresses: readonly string[]
}): readonly EncodeObject[] {
  return params.validatorAddresses.map((validatorAddress) =>
    buildMsgWithdrawDelegatorReward({
      delegatorAddress: params.delegatorAddress,
      validatorAddress,
    }),
  )
}
