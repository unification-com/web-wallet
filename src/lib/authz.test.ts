import { describe, expect, it } from 'vitest'

import {
  AuthorizationType,
  GenericAuthorization,
  GENERIC_AUTHORIZATION_URL,
  SEND_AUTHORIZATION_URL,
  STAKE_AUTHORIZATION_URL,
  SendAuthorization,
  StakeAuthorization,
  decodeAuthorization,
} from './authz'

describe('authz.decodeAuthorization', () => {
  it('decodes a delegate-only StakeAuthorization', () => {
    const enc = StakeAuthorization.encode(
      StakeAuthorization.fromPartial({
        authorizationType: AuthorizationType.AUTHORIZATION_TYPE_DELEGATE,
        maxTokens: { denom: 'nund', amount: '1000000000' },
      }),
    ).finish()
    const decoded = decodeAuthorization({ typeUrl: STAKE_AUTHORIZATION_URL, value: enc })
    expect(decoded.kind).toBe('stake')
    if (decoded.kind !== 'stake') throw new Error('unreachable')
    expect(decoded.authzType).toBe(AuthorizationType.AUTHORIZATION_TYPE_DELEGATE)
    expect(decoded.maxTokens).toEqual({ denom: 'nund', amount: '1000000000' })
    expect(decoded.allowList).toBeNull()
    expect(decoded.denyList).toBeNull()
  })

  it('decodes StakeAuthorization with an allow list', () => {
    const enc = StakeAuthorization.encode(
      StakeAuthorization.fromPartial({
        authorizationType: AuthorizationType.AUTHORIZATION_TYPE_DELEGATE,
        allowList: { address: ['undvaloper1abc', 'undvaloper1def'] },
      }),
    ).finish()
    const decoded = decodeAuthorization({ typeUrl: STAKE_AUTHORIZATION_URL, value: enc })
    if (decoded.kind !== 'stake') throw new Error('expected stake')
    expect(decoded.allowList).toEqual(['undvaloper1abc', 'undvaloper1def'])
    expect(decoded.denyList).toBeNull()
  })

  it('decodes a SendAuthorization with spend limit', () => {
    const enc = SendAuthorization.encode(
      SendAuthorization.fromPartial({
        spendLimit: [{ denom: 'nund', amount: '500000000' }],
        allowList: ['und1xyz'],
      }),
    ).finish()
    const decoded = decodeAuthorization({ typeUrl: SEND_AUTHORIZATION_URL, value: enc })
    if (decoded.kind !== 'send') throw new Error('expected send')
    expect(decoded.spendLimit).toHaveLength(1)
    expect(decoded.spendLimit[0]).toEqual({ denom: 'nund', amount: '500000000' })
    expect(decoded.allowList).toEqual(['und1xyz'])
  })

  it('decodes a GenericAuthorization', () => {
    const enc = GenericAuthorization.encode(
      GenericAuthorization.fromPartial({ msg: '/cosmos.bank.v1beta1.MsgSend' }),
    ).finish()
    const decoded = decodeAuthorization({ typeUrl: GENERIC_AUTHORIZATION_URL, value: enc })
    if (decoded.kind !== 'generic') throw new Error('expected generic')
    expect(decoded.msgTypeUrl).toBe('/cosmos.bank.v1beta1.MsgSend')
  })

  it('returns unknown for an unrecognised typeUrl', () => {
    const decoded = decodeAuthorization({
      typeUrl: '/cosmos.something.unknown',
      value: new Uint8Array([1, 2, 3]),
    })
    expect(decoded.kind).toBe('unknown')
    if (decoded.kind !== 'unknown') throw new Error('unreachable')
    expect(decoded.typeUrl).toBe('/cosmos.something.unknown')
  })

  it('returns unknown for an undefined authorization', () => {
    const decoded = decodeAuthorization(undefined)
    expect(decoded.kind).toBe('unknown')
  })

  it('falls back to unknown on corrupt bytes (no throw)', () => {
    // Wrong typeUrl/bytes combination — proto decode will either throw or
    // produce garbage. Either way we expect a clean fallback.
    const decoded = decodeAuthorization({
      typeUrl: STAKE_AUTHORIZATION_URL,
      value: new Uint8Array([0xff, 0xff, 0xff, 0xff, 0xff]),
    })
    // Could decode to a zero-stake authz OR fall to unknown depending on
    // how forgiving the proto decoder is for that byte sequence — either
    // is acceptable; the contract is "never throw".
    expect(['stake', 'unknown']).toContain(decoded.kind)
  })
})
