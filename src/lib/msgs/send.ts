import { type EncodeObject } from '@cosmjs/proto-signing'
import { z } from 'zod'

// ---------------------------------------------------------------------------
// MsgSend (cosmos-sdk bank module) — the bank-transfer Tx type
// ---------------------------------------------------------------------------

/** Bech32 address with the Unification `und` prefix. */
const Bech32Schema = z
  .string()
  .regex(/^und1[a-z0-9]{38,58}$/, 'must be a valid und1… address')

/** Positive decimal amount string — e.g. "10", "0.001". Form-side validation. */
const AmountSchema = z
  .string()
  .regex(/^[0-9]+(\.[0-9]+)?$/, 'amount must be a positive decimal')
  .refine((s) => Number(s) > 0, 'amount must be greater than zero')

export const SendFormSchema = z.object({
  recipient: Bech32Schema,
  amountFund: AmountSchema, // human-friendly FUND amount (will be scaled to nund)
  denom: z.string().min(1).default('nund'),
  memo: z.string().max(256).optional(),
})

export type SendFormValues = z.infer<typeof SendFormSchema>

/** Scaling factor between FUND (human-readable) and nund (chain-side). */
const NUND_PER_FUND = 1_000_000_000n // 10^9

/** Convert a decimal FUND string to a nund integer string (chain-side amount). */
export function fundToNund(amountFund: string): string {
  // Split on decimal point; both halves default to '0' / '' for safety.
  const [intPart, fracPart = ''] = amountFund.split('.')
  const safeIntPart = intPart === '' ? '0' : intPart
  // Pad/truncate fractional part to exactly 9 digits (the nund precision).
  const paddedFrac = (fracPart + '000000000').slice(0, 9)
  const nundStr = (BigInt(safeIntPart) * NUND_PER_FUND + BigInt(paddedFrac)).toString()
  return nundStr
}

export interface BuildMsgSendParams {
  fromAddress: string
  toAddress: string
  amountFund: string
  denom?: string // defaults to 'nund'
}

/**
 * Build a `MsgSend` EncodeObject suitable for `SigningStargateClient.signAndBroadcast`.
 * cosmjs ships an Amino+Direct registry for this Msg out of the box.
 */
export function buildMsgSend(params: BuildMsgSendParams): EncodeObject {
  const denom = params.denom ?? 'nund'
  return {
    typeUrl: '/cosmos.bank.v1beta1.MsgSend',
    value: {
      fromAddress: params.fromAddress,
      toAddress: params.toAddress,
      amount: [{ denom, amount: fundToNund(params.amountFund) }],
    },
  }
}
