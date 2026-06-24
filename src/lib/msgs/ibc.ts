import { type EncodeObject } from '@cosmjs/proto-signing'
import { z } from 'zod'

// ---------------------------------------------------------------------------
// MsgTransfer (IBC applications/transfer v1)
// ---------------------------------------------------------------------------
// Sends a token from this chain to an IBC-connected counterparty chain.
// cosmjs's default registry covers `MsgTransfer`, so the registry plumbing
// from M6/M7 doesn't need any additions here.
//
// `timeout_timestamp` is unix-nanoseconds; we set "now + 10 minutes" which
// is the conventional middle-ground (long enough for slow relayers to catch
// up; short enough that abandoned packets release the funds via the
// timeout/refund path quickly).
// ---------------------------------------------------------------------------

/** Loose bech32 validator — accepts any prefix because the recipient lives
 * on a different chain (Osmosis = `osmo1…`, Cosmos Hub = `cosmos1…`, etc.).
 * The chain itself will reject malformed addresses on broadcast; we just
 * filter outright nonsense pre-submit. */
const AnyBech32Schema = z
  .string()
  .regex(/^[a-z][a-z0-9]{1,15}1[a-z0-9]{38,58}$/, 'must be a valid bech32 address')

const AmountSchema = z
  .string()
  .regex(/^[0-9]+(\.[0-9]+)?$/, 'amount must be a positive decimal')
  .refine((s) => Number(s) > 0, 'amount must be greater than zero')

export const SendIbcFormSchema = z.object({
  /** Source channel ID derived from the destination chain selector — we
   * stash it on the form so submit-time validation catches the case where
   * channel discovery failed. */
  sourceChannel: z.string().regex(/^channel-\d+$/, 'must be a valid channel-N id'),
  /** Destination-chain bech32. Validated loosely since we don't know the
   * prefix at compile time. */
  receiver: AnyBech32Schema,
  amountFund: AmountSchema, // user-input amount (FUND scale for nund; raw for IBC denoms)
  denom: z.string().min(1).default('nund'),
  memo: z.string().max(256).optional(),
})
export type SendIbcFormValues = z.infer<typeof SendIbcFormSchema>

/** Default packet timeout: now + 10 minutes, in unix nanoseconds. */
export function defaultTimeoutTimestampNs(): bigint {
  const TEN_MINUTES_MS = 10 * 60 * 1000
  // Multiply ms → ns. BigInt arithmetic to avoid the precision cliff at 2^53.
  return BigInt(Date.now() + TEN_MINUTES_MS) * 1_000_000n
}

export interface BuildMsgTransferParams {
  sender: string
  receiver: string
  sourceChannel: string
  /** Chain-side integer amount — caller scales via `userAmountToChain`
   * (`lib/balance.ts`) since the FUND→nund vs raw-IBC decimals choice is
   * denom-dependent. */
  amountChainSide: string
  denom: string
  /** Unix nanoseconds. Default to `defaultTimeoutTimestampNs()`. */
  timeoutTimestampNs: bigint
  memo?: string
}

/**
 * Build a `MsgTransfer` EncodeObject for sending a token over IBC. cosmjs
 * default registry registers this typeUrl, so no custom registry plumbing
 * needed — `useSubmitTx` broadcasts it correctly with the same gas fee
 * shape as a regular bank send (timeout-related gas overhead is tiny).
 */
export function buildMsgTransfer(params: BuildMsgTransferParams): EncodeObject {
  return {
    typeUrl: '/ibc.applications.transfer.v1.MsgTransfer',
    value: {
      sourcePort: 'transfer',
      sourceChannel: params.sourceChannel,
      token: {
        denom: params.denom,
        amount: params.amountChainSide,
      },
      sender: params.sender,
      receiver: params.receiver,
      // `timeoutHeight: { revisionNumber: 0, revisionHeight: 0 }` disables
      // height-based timeout; we rely on `timeoutTimestamp` for the cutoff.
      timeoutHeight: { revisionNumber: 0n, revisionHeight: 0n },
      timeoutTimestamp: params.timeoutTimestampNs,
      memo: params.memo ?? '',
    },
  }
}
