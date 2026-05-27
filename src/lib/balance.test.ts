import { describe, expect, it } from 'vitest'

import { displayDenom, formatCoinAmount, getBaseDenom, scaleByDecimals } from './balance'

describe('balance.getBaseDenom', () => {
  it('passes nund through unchanged', () => {
    expect(getBaseDenom('nund')).toBe('nund')
  })

  it('passes uatom through unchanged', () => {
    expect(getBaseDenom('uatom')).toBe('uatom')
  })

  it('unwraps single-hop wrapped nund', () => {
    expect(getBaseDenom('transfer/channel-2/nund')).toBe('nund')
  })

  it('unwraps single-hop wrapped uatom', () => {
    expect(getBaseDenom('transfer/channel-2/uatom')).toBe('uatom')
  })

  it('unwraps multi-hop wrapped tokens', () => {
    expect(getBaseDenom('transfer/channel-98/transfer/channel-141/uatom')).toBe('uatom')
  })

  it('stops on malformed transfer segments', () => {
    expect(getBaseDenom('transfer/not-a-channel/nund')).toBe('transfer/not-a-channel/nund')
  })

  it('passes opaque ibc/HASH through unchanged (already collapsed by chain)', () => {
    expect(getBaseDenom('ibc/AB12CD34')).toBe('ibc/AB12CD34')
  })
})

describe('balance.scaleByDecimals', () => {
  it('scales 1500000 by 6 → 1.5', () => {
    expect(scaleByDecimals('1500000', 6)).toBe('1.5')
  })

  it('scales a whole number with trailing-zero trim', () => {
    expect(scaleByDecimals('2000000', 6)).toBe('2')
  })

  it('handles sub-unit values without leading-zero loss', () => {
    expect(scaleByDecimals('1', 6)).toBe('0.000001')
  })

  it('scales an 18-decimal token (Ethereum-style)', () => {
    expect(scaleByDecimals('1500000000000000000', 18)).toBe('1.5')
  })

  it('returns "0" for empty input', () => {
    expect(scaleByDecimals('', 6)).toBe('0')
  })

  it('returns the input unchanged when decimals is 0', () => {
    expect(scaleByDecimals('1234', 0)).toBe('1234')
  })

  it('handles negative-zero-style edge: very-large bigint', () => {
    const big = '1' + '0'.repeat(40)
    expect(scaleByDecimals(big, 18)).toBe('10000000000000000000000')
  })
})

describe('balance.formatCoinAmount', () => {
  it('scales nund by 10^9', () => {
    expect(formatCoinAmount('1500000000', 'nund')).toBe('1.5')
  })

  it('treats wrapped nund as FUND', () => {
    expect(formatCoinAmount('1500000000', 'transfer/channel-2/nund')).toBe('1.5')
  })

  it('uses the explicit decimals argument when present', () => {
    expect(formatCoinAmount('1500000', 'uatom', 6)).toBe('1.5')
  })

  it('returns the raw integer for non-nund denoms without decimals', () => {
    expect(formatCoinAmount('1500000', 'uatom')).toBe('1500000')
  })

  it('returns the raw integer for ibc/HASH denoms without decimals', () => {
    expect(formatCoinAmount('1500000', 'ibc/AB12')).toBe('1500000')
  })
})

describe('balance.displayDenom', () => {
  it('renders nund as FUND', () => {
    expect(displayDenom('nund')).toBe('FUND')
  })

  it('renders wrapped nund as FUND', () => {
    expect(displayDenom('transfer/channel-2/nund')).toBe('FUND')
  })

  it('truncates opaque ibc/HASH', () => {
    expect(displayDenom('ibc/AB12CD34EF56789012345678ABCD1234')).toBe('ibc/AB12…1234')
  })

  it('uppercases plain denoms', () => {
    expect(displayDenom('uatom')).toBe('UATOM')
  })
})
