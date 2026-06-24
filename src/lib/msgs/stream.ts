import { type EncodeObject } from '@cosmjs/proto-signing'
import { z } from 'zod'

import { fundToNund } from './send'

// ---------------------------------------------------------------------------
// Stream Msg builders — `x/stream` v1
// ---------------------------------------------------------------------------
// 5 broadcastable Msg types per the Stage 5b multi-denom protocol:
//
//   - MsgCreateStream     (sender → chain)
//   - MsgClaimStream      (receiver → chain)
//   - MsgTopUpDeposit     (sender → chain)
//   - MsgUpdateFlowRate   (sender → chain)
//   - MsgCancelStream     (sender → chain, only when stream.cancellable === true)
//
// Stream identity is the `(sender, receiver, denom)` triple — Stage 5b
// widened the key with `denom` so a single (sender, receiver) pair can fund
// multiple denom-distinct streams. The typeUrls all live under
// `/mainchain.stream.v1.*`; cosmjs's default registry doesn't know them,
// so `src/lib/registry.ts` composes a custom registry that includes the
// telescope-generated GeneratedTypes from fundjs-react.
// ---------------------------------------------------------------------------

const Bech32Schema = z
  .string()
  .regex(/^und1[a-z0-9]{38,58}$/, 'must be a valid und1… address')

const AmountSchema = z
  .string()
  .regex(/^[0-9]+(\.[0-9]+)?$/, 'amount must be a positive decimal')
  .refine((s) => Number(s) > 0, 'amount must be greater than zero')

const FlowRateSchema = z
  .string()
  .regex(/^[0-9]+$/, 'flow rate must be a non-negative integer (nund/second)')
  .refine((s) => BigInt(s) > 0n, 'flow rate must be greater than zero')

const DenomSchema = z.string().min(1, 'denom is required')

// ---------------------------------------------------------------------------
// Form schemas
// ---------------------------------------------------------------------------

export const CreateStreamFormSchema = z.object({
  receiver: Bech32Schema,
  depositFund: AmountSchema, // human-friendly FUND amount; scaled to nund
  denom: DenomSchema.default('nund'),
  flowRateNundPerSec: FlowRateSchema,
  memo: z.string().max(256).optional(),
})
export type CreateStreamFormValues = z.infer<typeof CreateStreamFormSchema>

export const ClaimStreamFormSchema = z.object({
  sender: Bech32Schema,
  denom: DenomSchema,
  memo: z.string().max(256).optional(),
})
export type ClaimStreamFormValues = z.infer<typeof ClaimStreamFormSchema>

export const TopUpDepositFormSchema = z.object({
  receiver: Bech32Schema,
  depositFund: AmountSchema,
  denom: DenomSchema.default('nund'),
  memo: z.string().max(256).optional(),
})
export type TopUpDepositFormValues = z.infer<typeof TopUpDepositFormSchema>

export const UpdateFlowRateFormSchema = z.object({
  receiver: Bech32Schema,
  flowRateNundPerSec: FlowRateSchema,
  denom: DenomSchema,
  memo: z.string().max(256).optional(),
})
export type UpdateFlowRateFormValues = z.infer<typeof UpdateFlowRateFormSchema>

export const CancelStreamFormSchema = z.object({
  receiver: Bech32Schema,
  denom: DenomSchema,
  memo: z.string().max(256).optional(),
})
export type CancelStreamFormValues = z.infer<typeof CancelStreamFormSchema>

// ---------------------------------------------------------------------------
// Msg builders
// ---------------------------------------------------------------------------

/**
 * Build a `MsgCreateStream` EncodeObject. `sender` is the active signer
 * address; `receiver` is the form-supplied recipient. `depositFund` is a
 * human-friendly FUND decimal which gets scaled to nund automatically.
 * `flowRateNundPerSec` is the raw chain-side flow rate — the form layer
 * is expected to do FUND→nund conversion via `useCalculateFlowRate` when
 * the user picks a period (per second / per hour / per day / per month).
 */
export function buildMsgCreateStream(params: {
  sender: string
  receiver: string
  depositFund: string
  denom: string
  flowRateNundPerSec: string
}): EncodeObject {
  return {
    typeUrl: '/mainchain.stream.v1.MsgCreateStream',
    value: {
      sender: params.sender,
      receiver: params.receiver,
      deposit: {
        denom: params.denom,
        amount: fundToNund(params.depositFund),
      },
      flowRate: BigInt(params.flowRateNundPerSec),
    },
  }
}

/**
 * Build a `MsgClaimStream` EncodeObject. Stream key triple `(sender,
 * receiver, denom)` — `receiver` is the active signer (the one making the
 * claim), `sender` + `denom` are form-supplied to identify which inbound
 * stream to claim from.
 */
export function buildMsgClaimStream(params: {
  receiver: string
  sender: string
  denom: string
}): EncodeObject {
  return {
    typeUrl: '/mainchain.stream.v1.MsgClaimStream',
    value: {
      sender: params.sender,
      receiver: params.receiver,
      denom: params.denom,
    },
  }
}

/** Build a `MsgTopUpDeposit` EncodeObject. Adds to an existing stream's deposit. */
export function buildMsgTopUpDeposit(params: {
  sender: string
  receiver: string
  depositFund: string
  denom: string
}): EncodeObject {
  return {
    typeUrl: '/mainchain.stream.v1.MsgTopUpDeposit',
    value: {
      sender: params.sender,
      receiver: params.receiver,
      deposit: {
        denom: params.denom,
        amount: fundToNund(params.depositFund),
      },
    },
  }
}

/** Build a `MsgUpdateFlowRate` EncodeObject. Sender-side only. */
export function buildMsgUpdateFlowRate(params: {
  sender: string
  receiver: string
  flowRateNundPerSec: string
  denom: string
}): EncodeObject {
  return {
    typeUrl: '/mainchain.stream.v1.MsgUpdateFlowRate',
    value: {
      sender: params.sender,
      receiver: params.receiver,
      flowRate: BigInt(params.flowRateNundPerSec),
      denom: params.denom,
    },
  }
}

/**
 * Build a `MsgCancelStream` EncodeObject. The chain rejects this Msg when
 * `stream.cancellable === false` (chain sets it to false automatically when
 * the stream uses eFUND); the UI should disable the cancel control in that
 * case rather than rely on chain rejection.
 */
export function buildMsgCancelStream(params: {
  sender: string
  receiver: string
  denom: string
}): EncodeObject {
  return {
    typeUrl: '/mainchain.stream.v1.MsgCancelStream',
    value: {
      sender: params.sender,
      receiver: params.receiver,
      denom: params.denom,
    },
  }
}
