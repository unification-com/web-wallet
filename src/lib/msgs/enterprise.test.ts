import { describe, expect, it } from 'vitest'

import {
  buildMsgUndPurchaseOrder,
  RaisePurchaseOrderFormSchema,
} from './enterprise'

const PURCHASER = 'und1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq'

describe('msgs.enterprise.buildMsgUndPurchaseOrder', () => {
  it('scales FUND to nund + emits canonical typeUrl', () => {
    const msg = buildMsgUndPurchaseOrder({ purchaser: PURCHASER, amountFund: '5' })
    expect(msg.typeUrl).toBe('/mainchain.enterprise.v1.MsgUndPurchaseOrder')
    const v = msg.value as {
      purchaser: string
      amount: { denom: string; amount: string }
    }
    expect(v.purchaser).toBe(PURCHASER)
    expect(v.amount).toEqual({ denom: 'nund', amount: '5000000000' })
  })

  it('handles fractional FUND amounts', () => {
    const msg = buildMsgUndPurchaseOrder({ purchaser: PURCHASER, amountFund: '0.5' })
    const v = msg.value as { amount: { amount: string } }
    expect(v.amount.amount).toBe('500000000')
  })
})

describe('msgs.enterprise form schema', () => {
  it('accepts a valid input', () => {
    const r = RaisePurchaseOrderFormSchema.safeParse({
      purchaser: PURCHASER,
      amountFund: '10',
      memo: 'office expenses Q2',
    })
    expect(r.success).toBe(true)
  })

  it('rejects malformed bech32', () => {
    const r = RaisePurchaseOrderFormSchema.safeParse({
      purchaser: 'cosmos1invalid',
      amountFund: '10',
    })
    expect(r.success).toBe(false)
  })

  it('rejects zero amount', () => {
    const r = RaisePurchaseOrderFormSchema.safeParse({
      purchaser: PURCHASER,
      amountFund: '0',
    })
    expect(r.success).toBe(false)
  })

  it('rejects memo longer than 100 chars (proof-of-purchase cap)', () => {
    const r = RaisePurchaseOrderFormSchema.safeParse({
      purchaser: PURCHASER,
      amountFund: '10',
      memo: 'a'.repeat(101),
    })
    expect(r.success).toBe(false)
  })

  it('accepts memo at exactly the 100-char limit', () => {
    const r = RaisePurchaseOrderFormSchema.safeParse({
      purchaser: PURCHASER,
      amountFund: '10',
      memo: 'a'.repeat(100),
    })
    expect(r.success).toBe(true)
  })
})
