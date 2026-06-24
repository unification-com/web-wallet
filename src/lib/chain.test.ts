import { describe, expect, it } from 'vitest'

import {
  customToChainEndpoint,
  getBuiltInEndpoint,
  listBuiltInEndpoints,
  validateEndpointUrl,
} from './chain'
import { type CustomEndpoint } from './vault/types'

describe('chain.validateEndpointUrl', () => {
  it('accepts HTTPS URLs', () => {
    expect(validateEndpointUrl('https://rpc.unification.io:443')).toEqual({ ok: true })
    expect(validateEndpointUrl('https://example.com')).toEqual({ ok: true })
  })

  it('accepts HTTP only for localhost addresses', () => {
    expect(validateEndpointUrl('http://localhost:26657')).toEqual({ ok: true })
    expect(validateEndpointUrl('http://127.0.0.1:26657')).toEqual({ ok: true })
    expect(validateEndpointUrl('http://[::1]:26657')).toEqual({ ok: true })
  })

  it('rejects HTTP for non-localhost hosts', () => {
    const result = validateEndpointUrl('http://example.com')
    expect(result.ok).toBe(false)
    expect(result.reason).toMatch(/HTTP allowed only for localhost/)
  })

  it('rejects malformed URLs', () => {
    expect(validateEndpointUrl('not a url').ok).toBe(false)
    expect(validateEndpointUrl('').ok).toBe(false)
    expect(validateEndpointUrl('://nope').ok).toBe(false)
  })

  it('rejects unsupported protocols', () => {
    const ws = validateEndpointUrl('ws://localhost:26657')
    expect(ws.ok).toBe(false)
    expect(ws.reason).toMatch(/unsupported protocol/)
    expect(validateEndpointUrl('ftp://example.com').ok).toBe(false)
  })
})

describe('chain.getBuiltInEndpoint', () => {
  it('returns mainnet / testnet / devnet by id', () => {
    expect(getBuiltInEndpoint('mainnet')?.label).toBe('MainNet')
    expect(getBuiltInEndpoint('testnet')?.label).toBe('TestNet')
    expect(getBuiltInEndpoint('devnet')?.label).toBe('DevNet')
  })

  it('returns null for unknown ids', () => {
    expect(getBuiltInEndpoint('nope')).toBeNull()
    expect(getBuiltInEndpoint('')).toBeNull()
  })

  it('built-in endpoints carry source: "built-in"', () => {
    expect(getBuiltInEndpoint('mainnet')?.source).toBe('built-in')
  })
})

describe('chain.listBuiltInEndpoints', () => {
  it('returns all three built-ins', () => {
    const list = listBuiltInEndpoints()
    expect(list).toHaveLength(3)
    expect(list.map((e) => e.id).sort()).toEqual(['devnet', 'mainnet', 'testnet'])
  })
})

describe('chain.customToChainEndpoint', () => {
  it('maps a CustomEndpoint to the unified ChainEndpoint shape', () => {
    const custom: CustomEndpoint = {
      id: '11111111-1111-4111-8111-111111111111',
      label: 'My Node',
      rpc: 'https://my.node.example.com',
      rest: 'https://my.node.example.com/rest',
      chainId: 'FUND-Mainchain-V1',
      createdAt: 1_700_000_000_000,
    }
    const mapped = customToChainEndpoint(custom)
    expect(mapped).toEqual({
      id: custom.id,
      label: custom.label,
      rpc: custom.rpc,
      rest: custom.rest,
      source: 'custom',
    })
  })

  it('defaults rest to empty string when undefined', () => {
    const custom: CustomEndpoint = {
      id: '22222222-2222-4222-8222-222222222222',
      label: 'RPC-only',
      rpc: 'https://rpc-only.example.com',
      createdAt: 1_700_000_001_000,
    }
    expect(customToChainEndpoint(custom).rest).toBe('')
  })
})
