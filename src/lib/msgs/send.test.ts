import { describe, expect, it } from 'vitest'

import {
  buildMsgSend,
  decCoinToFund,
  fundToNund,
  nundToFund,
  SendFormSchema,
} from './send'

describe('msgs.send.fundToNund', () => {
  it('converts whole FUND amounts', () => {
    expect(fundToNund('1')).toBe('1000000000')
    expect(fundToNund('10')).toBe('10000000000')
    expect(fundToNund('0')).toBe('0')
  })

  it('converts fractional FUND amounts', () => {
    expect(fundToNund('0.5')).toBe('500000000')
    expect(fundToNund('0.001')).toBe('1000000')
    expect(fundToNund('1.5')).toBe('1500000000')
  })

  it('handles full nund precision (9 decimal places)', () => {
    expect(fundToNund('0.000000001')).toBe('1')
    expect(fundToNund('1.234567890')).toBe('1234567890')
  })

  it('truncates beyond 9 decimal places (does not round)', () => {
    expect(fundToNund('1.1234567899')).toBe('1123456789')
  })

  it('handles very large amounts without precision loss', () => {
    expect(fundToNund('1000000')).toBe('1000000000000000')
  })
})

describe('msgs.send.nundToFund', () => {
  it('formats whole nund as FUND with no decimal', () => {
    expect(nundToFund('1000000000')).toBe('1')
    expect(nundToFund('10000000000')).toBe('10')
    expect(nundToFund('0')).toBe('0')
  })

  it('formats fractional nund with trailing zeros trimmed', () => {
    expect(nundToFund('500000000')).toBe('0.5')
    expect(nundToFund('1000000')).toBe('0.001')
    expect(nundToFund('1500000000')).toBe('1.5')
  })

  it('formats sub-nund precision down to 10^-9', () => {
    expect(nundToFund('1')).toBe('0.000000001')
    expect(nundToFund('1234567890')).toBe('1.23456789')
  })

  it('handles proto Dec strings with fractional half (truncates)', () => {
    // Distribution rewards come back as Dec strings — fractional half discarded.
    expect(nundToFund('1234567890.123456789012345678')).toBe('1.23456789')
  })

  it('handles undefined and unparseable input', () => {
    expect(nundToFund(undefined)).toBe('0')
    expect(nundToFund('')).toBe('0')
    expect(nundToFund('not-a-number')).toBe('0')
  })

  it('round-trips fundToNund for representative amounts', () => {
    for (const fund of ['1', '0.5', '0.001', '1.5', '1.23456789', '1000']) {
      expect(nundToFund(fundToNund(fund))).toBe(fund)
    }
  })
})

describe('msgs.send.decCoinToFund', () => {
  it("regression: the operator's observed reward Dec renders as ~621.896 FUND, not ~6.2e20", () => {
    // The bug surfaced 2026-05-21: a pending-reward DecCoin came back as the
    // 30-digit BigInt below (LegacyDec raw integer, value × 10^18, in nund).
    // The expected FUND value is 621.896894030699218220... (truncated to 9
    // fractional digits with trailing zeros trimmed). The old code rendered
    // "621896894030699218220.754771639" because it treated the Dec int as
    // raw nund and only divided by 10^9.
    const raw = '621896894030699218220754771639'
    expect(decCoinToFund(raw)).toBe('621.89689403')
  })

  it('renders zero and undefined safely', () => {
    expect(decCoinToFund(undefined)).toBe('0')
    expect(decCoinToFund('')).toBe('0')
    expect(decCoinToFund('0')).toBe('0')
    expect(decCoinToFund('not-a-number')).toBe('0')
  })

  it('renders whole-FUND-equivalent Dec amounts as integers', () => {
    // 1 FUND = 10^9 nund = 10^27 in Dec encoding (Dec.i = 10^27).
    expect(decCoinToFund('1000000000000000000000000000')).toBe('1')
    // 10 FUND.
    expect(decCoinToFund('10000000000000000000000000000')).toBe('10')
  })

  it('renders fractional Dec amounts down to 9-digit FUND precision', () => {
    // 0.5 FUND = 5 × 10^26 in Dec encoding.
    expect(decCoinToFund('500000000000000000000000000')).toBe('0.5')
    // 0.001 FUND = 10^24.
    expect(decCoinToFund('1000000000000000000000000')).toBe('0.001')
    // 1.5 FUND = 1.5 × 10^27.
    expect(decCoinToFund('1500000000000000000000000000')).toBe('1.5')
  })

  it('truncates Dec sub-nund precision (extra 18 digits below 10^-9 FUND)', () => {
    // 1.5 FUND with full Dec noise below the 9th FUND-fractional digit → still 1.5.
    expect(decCoinToFund('1500000000123456789012345678')).toBe('1.5')
  })

  it('accepts the Dec.String()-style decimal-pointed legacy form', () => {
    // Dec.String() of 1 FUND of rewards = "1000000000.000000000000000000" —
    // 9-digit nund integer + 18 sub-nund fractional digits (Precision=18).
    expect(decCoinToFund('1000000000.000000000000000000')).toBe('1')
    // Dec.String() of 0.5 FUND = "500000000.000000000000000000".
    expect(decCoinToFund('500000000.000000000000000000')).toBe('0.5')
  })

  it('matches the round-trip through fundToNund/nundToFund for whole amounts', () => {
    // 1 FUND of pending rewards → 10^27 Dec int → decCoinToFund → "1"
    //   → fundToNund → "1000000000" → nundToFund → "1"
    const oneFundDec = '1000000000000000000000000000'
    expect(decCoinToFund(oneFundDec)).toBe('1')
    expect(nundToFund(fundToNund(decCoinToFund(oneFundDec)))).toBe('1')
  })
})

describe('msgs.send.buildMsgSend', () => {
  it('builds a properly-shaped MsgSend EncodeObject', () => {
    const msg = buildMsgSend({
      fromAddress: 'und1from000000000000000000000000000000000000',
      toAddress: 'und1to0000000000000000000000000000000000000000',
      amountFund: '1.5',
    })
    expect(msg.typeUrl).toBe('/cosmos.bank.v1beta1.MsgSend')
    interface MsgSendValue {
      fromAddress: string
      toAddress: string
      amount: { denom: string; amount: string }[]
    }
    const value = msg.value as MsgSendValue
    expect(value.fromAddress).toBe('und1from000000000000000000000000000000000000')
    expect(value.toAddress).toBe('und1to0000000000000000000000000000000000000000')
    expect(value.amount).toEqual([{ denom: 'nund', amount: '1500000000' }])
  })

  it('respects a custom denom', () => {
    const msg = buildMsgSend({
      fromAddress: 'und1from000000000000000000000000000000000000',
      toAddress: 'und1to0000000000000000000000000000000000000000',
      amountFund: '1',
      denom: 'ibc/ABC123',
    })
    interface MsgSendValue {
      amount: { denom: string; amount: string }[]
    }
    const value = msg.value as MsgSendValue
    expect(value.amount[0].denom).toBe('ibc/ABC123')
  })
})

describe('msgs.send.SendFormSchema', () => {
  it('accepts a well-formed send', () => {
    const result = SendFormSchema.safeParse({
      recipient: 'und1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq',
      amountFund: '1.5',
      denom: 'nund',
    })
    expect(result.success).toBe(true)
  })

  it('rejects a non-Unification recipient', () => {
    const result = SendFormSchema.safeParse({
      recipient: 'cosmos1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq',
      amountFund: '1',
      denom: 'nund',
    })
    expect(result.success).toBe(false)
  })

  it('rejects zero or negative amount', () => {
    expect(
      SendFormSchema.safeParse({
        recipient: 'und1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq',
        amountFund: '0',
        denom: 'nund',
      }).success,
    ).toBe(false)
    expect(
      SendFormSchema.safeParse({
        recipient: 'und1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq',
        amountFund: '-1',
        denom: 'nund',
      }).success,
    ).toBe(false)
  })

  it('rejects non-numeric amount', () => {
    expect(
      SendFormSchema.safeParse({
        recipient: 'und1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq',
        amountFund: 'one',
        denom: 'nund',
      }).success,
    ).toBe(false)
  })

  it('rejects memo longer than 256 chars', () => {
    expect(
      SendFormSchema.safeParse({
        recipient: 'und1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq',
        amountFund: '1',
        denom: 'nund',
        memo: 'x'.repeat(257),
      }).success,
    ).toBe(false)
  })
})
