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

/**
 * Convert a chain-side nund integer string to a human-readable FUND decimal
 * string. Trailing zeros trimmed; whole numbers render without a decimal
 * point. Returns `'0'` on unparseable input — display contexts only, never
 * use this for amount arithmetic against the chain.
 *
 * Use this for `Coin.amount` values (account balances, delegation balances,
 * fee amounts) — those are integer nund. For `DecCoin.amount` values
 * (distribution rewards, validator commission, anything coming back as
 * `cosmossdk.io/math.LegacyDec` on the wire) use {@link decCoinToFund}
 * instead — those carry an extra 10^18 scaling factor that must be stripped
 * first or display values land 10^18× too large.
 */
export function nundToFund(amountNund: string | undefined): string {
  if (!amountNund) return '0'
  try {
    const intPart = amountNund.split('.')[0] ?? '0'
    const big = BigInt(intPart)
    const whole = big / NUND_PER_FUND
    const frac = (big % NUND_PER_FUND).toString().padStart(9, '0').replace(/0+$/, '')
    return frac ? `${whole.toString()}.${frac}` : whole.toString()
  } catch {
    return '0'
  }
}

/**
 * LegacyDec precision — the number of fractional digits the SDK Dec type
 * carries internally. The wire encoding for `DecCoin.amount` is the raw
 * BigInt of `value × 10^18` as a decimal string (no decimal point, despite
 * the Go-side `Dec.String()` formatting — the proto custom-type marshal
 * goes through `LegacyDec.Marshal` which writes the raw integer bytes).
 */
const DEC_PRECISION = 1_000_000_000_000_000_000n // 10^18

/**
 * Convert a chain-side `DecCoin.amount` string (raw `LegacyDec` integer,
 * value × 10^18 in nund) to a human-readable FUND decimal string. Strips
 * both the 10^18 Dec scaling and the 10^9 nund→FUND scaling in a single
 * BigInt divide so no intermediate precision is lost; the fractional part
 * is truncated at 9 digits (nund precision) with trailing zeros trimmed.
 *
 * Used for distribution rewards (`delegationTotalRewards` `rewards[].reward`
 * and `total`). Returns `'0'` on unparseable / empty input.
 */
export function decCoinToFund(amountDec: string | undefined): string {
  if (!amountDec) return '0'
  try {
    // Some legacy paths (or future cosmjs versions) might present a Dec
    // with a decimal point (e.g. `"0.500000000000000000"`). Strip it and
    // pad to 18 fractional digits before BigInt parsing so both shapes
    // resolve to the same scaled integer.
    let raw: bigint
    if (amountDec.includes('.')) {
      const [intPart, fracPart = ''] = amountDec.split('.')
      const padded = (fracPart + '000000000000000000').slice(0, 18)
      raw = BigInt((intPart || '0') + padded)
    } else {
      raw = BigInt(amountDec)
    }
    const scale = DEC_PRECISION * NUND_PER_FUND // 10^27 — Dec + nund→FUND combined
    const whole = raw / scale
    const frac = (raw % scale).toString().padStart(27, '0').slice(0, 9).replace(/0+$/, '')
    return frac ? `${whole.toString()}.${frac}` : whole.toString()
  } catch {
    return '0'
  }
}

export interface BuildMsgSendParams {
  fromAddress: string
  toAddress: string
  /** Chain-side integer amount (NOT a user-facing FUND decimal). Callers
   * should scale via `userAmountToChain(amount, denom)` from `lib/balance.ts`
   * to handle the denom-dependent decimals correctly: nund uses 10^9 FUND
   * scaling; IBC-wrapped denoms use the source chain's native decimals
   * which we treat as raw integers pre-M9. */
  amountChainSide: string
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
      amount: [{ denom, amount: params.amountChainSide }],
    },
  }
}
