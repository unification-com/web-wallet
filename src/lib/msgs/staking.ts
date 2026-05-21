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
 * Default fee for delegate / undelegate / redelegate / withdraw Txs.
 * Aligned with v1's `DEFAULT_STAKING_FEES` style — slightly more gas than
 * a bank send since the staking module's keeper does more work, but the
 * same fee denomination + amount. Chain-side this is well within the
 * minimum-gas-prices floor for `nund`.
 */
export const DEFAULT_STAKING_FEE = {
  amount: [{ denom: 'nund', amount: '25000000' }],
  gas: '250000',
}
