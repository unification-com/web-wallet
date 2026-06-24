import { describe, expect, it } from 'vitest'

import {
  AuthorizationType,
  GENERIC_AUTHORISATION_URL,
  GenericAuthorization,
  STAKE_AUTHORISATION_URL,
  StakeAuthorization,
} from '../authz'

import {
  buildMsgGrantGeneric,
  buildMsgGrantStake,
  buildMsgRevoke,
} from './authz'

const GRANTER = 'und1granter000000000000000000000000000000000'
const GRANTEE = 'und1grantee000000000000000000000000000000000'

interface MsgGrantValue {
  granter: string
  grantee: string
  grant?: {
    authorization?: { typeUrl: string; value: Uint8Array }
    expiration?: { seconds: bigint; nanos: number }
  }
}

interface MsgRevokeValue {
  granter: string
  grantee: string
  msgTypeUrl: string
}

describe('msgs/authz.buildMsgRevoke', () => {
  it('builds a MsgRevoke EncodeObject with the right typeUrl + fields', () => {
    const msg = buildMsgRevoke({
      granter: GRANTER,
      grantee: GRANTEE,
      msgTypeUrl: '/cosmos.staking.v1beta1.MsgDelegate',
    })
    expect(msg.typeUrl).toBe('/cosmos.authz.v1beta1.MsgRevoke')
    const value = msg.value as MsgRevokeValue
    expect(value).toEqual({
      granter: GRANTER,
      grantee: GRANTEE,
      msgTypeUrl: '/cosmos.staking.v1beta1.MsgDelegate',
    })
  })
})

describe('msgs/authz.buildMsgGrantStake', () => {
  it('builds a delegate-only grant with no cap, no list, no expiry', () => {
    const msg = buildMsgGrantStake({
      granter: GRANTER,
      values: {
        grantee: GRANTEE,
        authzType: 'delegate',
        maxFund: '',
        listMode: 'any',
        validators: [],
        expiresAtMs: undefined,
      },
    })
    expect(msg.typeUrl).toBe('/cosmos.authz.v1beta1.MsgGrant')
    const value = msg.value as MsgGrantValue
    expect(value.granter).toBe(GRANTER)
    expect(value.grantee).toBe(GRANTEE)
    expect(value.grant?.authorization?.typeUrl).toBe(STAKE_AUTHORISATION_URL)
    expect(value.grant?.expiration).toBeUndefined()

    const decoded = StakeAuthorization.decode(value.grant?.authorization?.value ?? new Uint8Array())
    expect(decoded.authorizationType).toBe(AuthorizationType.AUTHORIZATION_TYPE_DELEGATE)
    expect(decoded.maxTokens).toBeUndefined()
    expect(decoded.allowList).toBeUndefined()
    expect(decoded.denyList).toBeUndefined()
  })

  it('scales maxFund through fundToNund (1.5 FUND → 1500000000 nund)', () => {
    const msg = buildMsgGrantStake({
      granter: GRANTER,
      values: {
        grantee: GRANTEE,
        authzType: 'delegate',
        maxFund: '1.5',
        listMode: 'any',
        validators: [],
        expiresAtMs: undefined,
      },
    })
    const value = msg.value as MsgGrantValue
    const decoded = StakeAuthorization.decode(value.grant?.authorization?.value ?? new Uint8Array())
    expect(decoded.maxTokens).toEqual({ denom: 'nund', amount: '1500000000' })
  })

  it('wires an allow list when listMode=allow', () => {
    const msg = buildMsgGrantStake({
      granter: GRANTER,
      values: {
        grantee: GRANTEE,
        authzType: 'delegate',
        maxFund: '',
        listMode: 'allow',
        validators: ['undvaloper1aaa', 'undvaloper1bbb'],
        expiresAtMs: undefined,
      },
    })
    const value = msg.value as MsgGrantValue
    const decoded = StakeAuthorization.decode(value.grant?.authorization?.value ?? new Uint8Array())
    expect(decoded.allowList?.address).toEqual(['undvaloper1aaa', 'undvaloper1bbb'])
    expect(decoded.denyList).toBeUndefined()
  })

  it('wires a deny list when listMode=deny', () => {
    const msg = buildMsgGrantStake({
      granter: GRANTER,
      values: {
        grantee: GRANTEE,
        authzType: 'redelegate',
        maxFund: '',
        listMode: 'deny',
        validators: ['undvaloper1ccc'],
        expiresAtMs: undefined,
      },
    })
    const value = msg.value as MsgGrantValue
    const decoded = StakeAuthorization.decode(value.grant?.authorization?.value ?? new Uint8Array())
    expect(decoded.authorizationType).toBe(AuthorizationType.AUTHORIZATION_TYPE_REDELEGATE)
    expect(decoded.denyList?.address).toEqual(['undvaloper1ccc'])
    expect(decoded.allowList).toBeUndefined()
  })

  it('converts expiresAtMs to a proto Timestamp', () => {
    // 2026-12-01T00:00:00Z → 1796428800000 ms → 1796428800 seconds
    const expiresAtMs = 1796428800000
    const msg = buildMsgGrantStake({
      granter: GRANTER,
      values: {
        grantee: GRANTEE,
        authzType: 'delegate',
        maxFund: '',
        listMode: 'any',
        validators: [],
        expiresAtMs,
      },
    })
    const value = msg.value as MsgGrantValue
    expect(value.grant?.expiration?.seconds).toBe(1796428800n)
    expect(value.grant?.expiration?.nanos).toBe(0)
  })

  it('maps "any" authzType to UNSPECIFIED', () => {
    const msg = buildMsgGrantStake({
      granter: GRANTER,
      values: {
        grantee: GRANTEE,
        authzType: 'any',
        maxFund: '',
        listMode: 'any',
        validators: [],
        expiresAtMs: undefined,
      },
    })
    const value = msg.value as MsgGrantValue
    const decoded = StakeAuthorization.decode(value.grant?.authorization?.value ?? new Uint8Array())
    expect(decoded.authorizationType).toBe(AuthorizationType.AUTHORIZATION_TYPE_UNSPECIFIED)
  })
})

describe('msgs/authz.buildMsgGrantGeneric', () => {
  it('builds a generic grant with the specified inner-Msg type-url', () => {
    const msg = buildMsgGrantGeneric({
      granter: GRANTER,
      values: {
        grantee: GRANTEE,
        msgTypeUrl: '/cosmos.bank.v1beta1.MsgSend',
        expiresAtMs: undefined,
      },
    })
    expect(msg.typeUrl).toBe('/cosmos.authz.v1beta1.MsgGrant')
    const value = msg.value as MsgGrantValue
    expect(value.grant?.authorization?.typeUrl).toBe(GENERIC_AUTHORISATION_URL)
    const decoded = GenericAuthorization.decode(value.grant?.authorization?.value ?? new Uint8Array())
    expect(decoded.msg).toBe('/cosmos.bank.v1beta1.MsgSend')
  })
})
