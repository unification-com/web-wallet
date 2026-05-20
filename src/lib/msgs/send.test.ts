import { describe, expect, it } from 'vitest'

import { buildMsgSend, fundToNund, SendFormSchema } from './send'

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
