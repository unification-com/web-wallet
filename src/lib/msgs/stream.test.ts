import { describe, expect, it } from 'vitest'

import {
  buildMsgCancelStream,
  buildMsgClaimStream,
  buildMsgCreateStream,
  buildMsgTopUpDeposit,
  buildMsgUpdateFlowRate,
  CancelStreamFormSchema,
  ClaimStreamFormSchema,
  CreateStreamFormSchema,
  TopUpDepositFormSchema,
  UpdateFlowRateFormSchema,
} from './stream'

const SENDER = 'und1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq'
const RECEIVER = 'und1wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww'

describe('msgs.stream.buildMsgCreateStream', () => {
  it('scales FUND to nund + carries flow rate as bigint', () => {
    const msg = buildMsgCreateStream({
      sender: SENDER,
      receiver: RECEIVER,
      depositFund: '1.5',
      denom: 'nund',
      flowRateNundPerSec: '100',
    })
    expect(msg.typeUrl).toBe('/mainchain.stream.v1.MsgCreateStream')
    const v = msg.value as {
      sender: string
      receiver: string
      deposit: { denom: string; amount: string }
      flowRate: bigint
    }
    expect(v.sender).toBe(SENDER)
    expect(v.receiver).toBe(RECEIVER)
    expect(v.deposit).toEqual({ denom: 'nund', amount: '1500000000' })
    expect(v.flowRate).toBe(100n)
  })

  it('preserves a non-nund denom (multi-denom Stage 5b)', () => {
    const msg = buildMsgCreateStream({
      sender: SENDER,
      receiver: RECEIVER,
      depositFund: '10',
      denom: 'ibc/ABCDEF',
      flowRateNundPerSec: '1',
    })
    const v = msg.value as { deposit: { denom: string; amount: string } }
    expect(v.deposit.denom).toBe('ibc/ABCDEF')
  })
})

describe('msgs.stream.buildMsgClaimStream', () => {
  it('emits the (sender, receiver, denom) triple', () => {
    const msg = buildMsgClaimStream({
      receiver: RECEIVER,
      sender: SENDER,
      denom: 'nund',
    })
    expect(msg.typeUrl).toBe('/mainchain.stream.v1.MsgClaimStream')
    expect(msg.value).toEqual({
      sender: SENDER,
      receiver: RECEIVER,
      denom: 'nund',
    })
  })
})

describe('msgs.stream.buildMsgTopUpDeposit', () => {
  it('scales the additional deposit + preserves denom', () => {
    const msg = buildMsgTopUpDeposit({
      sender: SENDER,
      receiver: RECEIVER,
      depositFund: '0.25',
      denom: 'nund',
    })
    expect(msg.typeUrl).toBe('/mainchain.stream.v1.MsgTopUpDeposit')
    const v = msg.value as { deposit: { denom: string; amount: string } }
    expect(v.deposit).toEqual({ denom: 'nund', amount: '250000000' })
  })
})

describe('msgs.stream.buildMsgUpdateFlowRate', () => {
  it('emits flowRate as bigint + carries denom', () => {
    const msg = buildMsgUpdateFlowRate({
      sender: SENDER,
      receiver: RECEIVER,
      flowRateNundPerSec: '5000',
      denom: 'nund',
    })
    expect(msg.typeUrl).toBe('/mainchain.stream.v1.MsgUpdateFlowRate')
    const v = msg.value as { flowRate: bigint; denom: string }
    expect(v.flowRate).toBe(5_000n)
    expect(v.denom).toBe('nund')
  })
})

describe('msgs.stream.buildMsgCancelStream', () => {
  it('emits the (sender, receiver, denom) triple', () => {
    const msg = buildMsgCancelStream({
      sender: SENDER,
      receiver: RECEIVER,
      denom: 'nund',
    })
    expect(msg.typeUrl).toBe('/mainchain.stream.v1.MsgCancelStream')
    expect(msg.value).toEqual({
      sender: SENDER,
      receiver: RECEIVER,
      denom: 'nund',
    })
  })
})

describe('msgs.stream form schemas', () => {
  it('CreateStream rejects malformed bech32', () => {
    const r = CreateStreamFormSchema.safeParse({
      receiver: 'cosmos1invalid',
      depositFund: '1',
      denom: 'nund',
      flowRateNundPerSec: '100',
    })
    expect(r.success).toBe(false)
  })

  it('CreateStream rejects zero flow rate', () => {
    const r = CreateStreamFormSchema.safeParse({
      receiver: RECEIVER,
      depositFund: '1',
      denom: 'nund',
      flowRateNundPerSec: '0',
    })
    expect(r.success).toBe(false)
  })

  it('CreateStream accepts a valid input + defaults denom to nund', () => {
    const r = CreateStreamFormSchema.safeParse({
      receiver: RECEIVER,
      depositFund: '1.5',
      flowRateNundPerSec: '100',
    })
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.denom).toBe('nund')
    }
  })

  it('ClaimStream requires denom', () => {
    const r = ClaimStreamFormSchema.safeParse({
      sender: SENDER,
      denom: '',
    })
    expect(r.success).toBe(false)
  })

  it('TopUpDeposit accepts a valid input', () => {
    const r = TopUpDepositFormSchema.safeParse({
      receiver: RECEIVER,
      depositFund: '0.5',
      denom: 'nund',
    })
    expect(r.success).toBe(true)
  })

  it('UpdateFlowRate accepts a valid input', () => {
    const r = UpdateFlowRateFormSchema.safeParse({
      receiver: RECEIVER,
      flowRateNundPerSec: '5000',
      denom: 'nund',
    })
    expect(r.success).toBe(true)
  })

  it('CancelStream accepts a valid input', () => {
    const r = CancelStreamFormSchema.safeParse({
      receiver: RECEIVER,
      denom: 'nund',
    })
    expect(r.success).toBe(true)
  })
})
