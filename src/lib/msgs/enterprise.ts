import { type EncodeObject } from '@cosmjs/proto-signing'
import { z } from 'zod'

import { fundToNund } from './send'

// ---------------------------------------------------------------------------
// Enterprise Msg builders — `x/enterprise` v1
// ---------------------------------------------------------------------------
// One broadcastable Msg type for the wallet-side flow (admin-only Msgs
// `MsgProcessUndPurchaseOrder` / `MsgWhitelistAddress` stay out of scope per
// the M7 tracker):
//
//   - MsgUndPurchaseOrder    (purchaser → chain)
//
// Memo doubles as "proof of purchase" in v1 convention — 100-char cap is
// enforced by chain validation; this form caps at the same value pre-broadcast.
// ---------------------------------------------------------------------------

const Bech32Schema = z
  .string()
  .regex(/^und1[a-z0-9]{38,58}$/, 'must be a valid und1… address')

const AmountSchema = z
  .string()
  .regex(/^[0-9]+(\.[0-9]+)?$/, 'amount must be a positive decimal')
  .refine((s) => Number(s) > 0, 'amount must be greater than zero')

// ---------------------------------------------------------------------------
// Form schema
// ---------------------------------------------------------------------------

export const RaisePurchaseOrderFormSchema = z.object({
  purchaser: Bech32Schema,
  amountFund: AmountSchema, // human-friendly FUND; scaled to nund
  // v1 convention: memo doubles as "proof of purchase" string for the PO.
  // Chain enforces a 100-char cap; mirror that here so submit-time
  // validation matches.
  memo: z.string().max(100).optional(),
})
export type RaisePurchaseOrderFormValues = z.infer<typeof RaisePurchaseOrderFormSchema>

// ---------------------------------------------------------------------------
// Msg builder
// ---------------------------------------------------------------------------

/**
 * Build a `MsgUndPurchaseOrder` EncodeObject. `purchaser` is the active
 * signer's bech32 address. `amount` is always nund-denominated (eFUND is
 * minted in nund by the chain on PO acceptance).
 */
export function buildMsgUndPurchaseOrder(params: {
  purchaser: string
  amountFund: string
}): EncodeObject {
  return {
    typeUrl: '/mainchain.enterprise.v1.MsgUndPurchaseOrder',
    value: {
      purchaser: params.purchaser,
      amount: {
        denom: 'nund',
        amount: fundToNund(params.amountFund),
      },
    },
  }
}
