import { type EncodeObject } from '@cosmjs/proto-signing'
import { z } from 'zod'

import {
  AuthorizationType,
  GENERIC_AUTHORISATION_URL,
  GenericAuthorization,
  SEND_AUTHORISATION_URL,
  STAKE_AUTHORISATION_URL,
  StakeAuthorization,
} from '@/lib/authz'

import { fundToNund } from './send'

// ---------------------------------------------------------------------------
// Default fee for authz Txs — light, gov-style Msgs (no chain state churn
// beyond writing one record). Matches the staking-fee gas budget for
// safety; authz Txs are infrequent enough that headroom isn't a cost
// concern.
// ---------------------------------------------------------------------------

export const DEFAULT_AUTHZ_FEE = {
  amount: [{ denom: 'nund', amount: '20000000' }],
  gas: '200000',
}

// ---------------------------------------------------------------------------
// Bech32 helpers — shared with other Msg builders
// ---------------------------------------------------------------------------

const ACCOUNT_BECH32_RE = /^und1[a-z0-9]{38,58}$/
const VALIDATOR_BECH32_RE = /^undvaloper1[a-z0-9]{38,58}$/

// ---------------------------------------------------------------------------
// MsgRevoke — drops any grant of the given msgTypeUrl from grantee
// ---------------------------------------------------------------------------

export const RevokeFormSchema = z.object({
  grantee: z.string().regex(ACCOUNT_BECH32_RE, 'grantee must be a valid und1… address'),
  msgTypeUrl: z.string().min(1, 'msg type URL is required'),
})
export type RevokeFormValues = z.infer<typeof RevokeFormSchema>

export function buildMsgRevoke(params: {
  granter: string
  grantee: string
  msgTypeUrl: string
}): EncodeObject {
  return {
    typeUrl: '/cosmos.authz.v1beta1.MsgRevoke',
    value: {
      granter: params.granter,
      grantee: params.grantee,
      msgTypeUrl: params.msgTypeUrl,
    },
  }
}

// ---------------------------------------------------------------------------
// MsgGrant — three flavours (Stake / Send / Generic)
// ---------------------------------------------------------------------------
// MsgGrant wraps an `Authorization` in an `Any`; cosmjs's default registry
// needs the inner authorisation encoded ahead of time. Each builder below
// constructs the `Any` from the proto-generated `encode` then composes the
// MsgGrant value.

/**
 * Build an `Any` from a proto-encoded message + its typeUrl. Used by the
 * MsgGrant builders below to wrap inner Authorisation shapes.
 */
function encodeAuthorisationAny(
  typeUrl: string,
  bytes: Uint8Array,
): { typeUrl: string; value: Uint8Array } {
  return { typeUrl, value: bytes }
}

/** Convert a Date / Unix-ms / undefined into the `{ seconds, nanos }` timestamp
 * shape cosmjs-types uses. `undefined` → no expiration (grant never expires). */
function dateToTimestamp(date: Date | number | undefined): { seconds: bigint; nanos: number } | undefined {
  if (date === undefined) return undefined
  const ms = typeof date === 'number' ? date : date.getTime()
  if (!Number.isFinite(ms) || ms <= 0) return undefined
  return {
    seconds: BigInt(Math.floor(ms / 1000)),
    nanos: (ms % 1000) * 1_000_000,
  }
}

// --- StakeAuthorization ----------------------------------------------------

/** Form values for granting a `StakeAuthorization` to an auto-compounder. */
export const StakeGrantFormSchema = z
  .object({
    grantee: z.string().regex(ACCOUNT_BECH32_RE, 'grantee must be a valid und1… address'),
    authzType: z.enum(['delegate', 'undelegate', 'redelegate', 'any']),
    /** Optional FUND-denominated cap on total tokens that may be staked under this grant. */
    maxFund: z.string().regex(/^(\d+(\.\d+)?)?$/, 'must be a positive decimal or empty').optional(),
    /** Allow- or deny-list of validator operator addresses (mutually exclusive). */
    listMode: z.enum(['any', 'allow', 'deny']),
    validators: z.array(z.string().regex(VALIDATOR_BECH32_RE)).default([]),
    /** Expiry as Unix milliseconds; undefined = no expiration. */
    expiresAtMs: z.number().int().positive().optional(),
  })
  .refine((data) => data.listMode === 'any' || data.validators.length > 0, {
    message: 'pick at least one validator when using allow/deny list',
    path: ['validators'],
  })
export type StakeGrantFormValues = z.infer<typeof StakeGrantFormSchema>

const AUTHZ_TYPE_MAP: Record<StakeGrantFormValues['authzType'], AuthorizationType> = {
  delegate: AuthorizationType.AUTHORIZATION_TYPE_DELEGATE,
  undelegate: AuthorizationType.AUTHORIZATION_TYPE_UNDELEGATE,
  redelegate: AuthorizationType.AUTHORIZATION_TYPE_REDELEGATE,
  any: AuthorizationType.AUTHORIZATION_TYPE_UNSPECIFIED,
}

export function buildMsgGrantStake(params: {
  granter: string
  values: StakeGrantFormValues
}): EncodeObject {
  const { grantee, authzType, maxFund, listMode, validators, expiresAtMs } = params.values
  const authorisation = StakeAuthorization.fromPartial({
    authorizationType: AUTHZ_TYPE_MAP[authzType],
    ...(maxFund && maxFund !== ''
      ? { maxTokens: { denom: 'nund', amount: fundToNund(maxFund) } }
      : {}),
    ...(listMode === 'allow' ? { allowList: { address: validators } } : {}),
    ...(listMode === 'deny' ? { denyList: { address: validators } } : {}),
  })
  const encoded = StakeAuthorization.encode(authorisation).finish()
  return {
    typeUrl: '/cosmos.authz.v1beta1.MsgGrant',
    value: {
      granter: params.granter,
      grantee,
      grant: {
        authorization: encodeAuthorisationAny(STAKE_AUTHORISATION_URL, encoded),
        expiration: dateToTimestamp(expiresAtMs),
      },
    },
  }
}

// --- GenericAuthorization --------------------------------------------------

export const GenericGrantFormSchema = z.object({
  grantee: z.string().regex(ACCOUNT_BECH32_RE, 'grantee must be a valid und1… address'),
  msgTypeUrl: z.string().min(1, 'msg type URL is required (e.g. /cosmos.bank.v1beta1.MsgSend)'),
  expiresAtMs: z.number().int().positive().optional(),
})
export type GenericGrantFormValues = z.infer<typeof GenericGrantFormSchema>

export function buildMsgGrantGeneric(params: {
  granter: string
  values: GenericGrantFormValues
}): EncodeObject {
  const authorisation = GenericAuthorization.fromPartial({
    msg: params.values.msgTypeUrl,
  })
  const encoded = GenericAuthorization.encode(authorisation).finish()
  return {
    typeUrl: '/cosmos.authz.v1beta1.MsgGrant',
    value: {
      granter: params.granter,
      grantee: params.values.grantee,
      grant: {
        authorization: encodeAuthorisationAny(GENERIC_AUTHORISATION_URL, encoded),
        expiration: dateToTimestamp(params.values.expiresAtMs),
      },
    },
  }
}

// --- SendAuthorization -----------------------------------------------------
// Build a `SendAuthorization` programmatically — exported as a thin
// pre-encode helper so callers can preview the inner shape before grant
// builders consume it. Currently unused by the UI (Send/Stake/Generic
// chosen as the v0.22 surface) but kept exported so M10's "out-of-scope"
// list stays honest — adding the Send-grant form later doesn't need new
// types.
export { SEND_AUTHORISATION_URL }
