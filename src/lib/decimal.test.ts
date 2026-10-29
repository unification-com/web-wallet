import { i18n } from '@lingui/core'
import { afterEach, describe, expect, it } from 'vitest'

import { formatDecimal, scaleByDecimals } from './decimal'

describe('decimal.scaleByDecimals', () => {
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

describe('decimal.formatDecimal', () => {
  afterEach(() => {
    i18n.activate('en')
  })

  it('groups the whole part and keeps every fractional digit', () => {
    expect(formatDecimal('20000000.1234567')).toBe('20,000,000.1234567')
  })

  it('groups whole numbers', () => {
    expect(formatDecimal('1234567')).toBe('1,234,567')
  })

  it('leaves values under 1,000 unchanged', () => {
    expect(formatDecimal('999.5')).toBe('999.5')
    expect(formatDecimal('0.000000001')).toBe('0.000000001')
  })

  it('keeps full precision beyond what a JS number holds', () => {
    expect(formatDecimal('123456789012345678901.123456789')).toBe('123,456,789,012,345,678,901.123456789')
  })

  it('handles a leading minus sign', () => {
    expect(formatDecimal('-1234.5')).toBe('-1,234.5')
  })

  it('returns non-decimal input unchanged', () => {
    expect(formatDecimal('')).toBe('')
    expect(formatDecimal('1,234')).toBe('1,234')
    expect(formatDecimal('abc')).toBe('abc')
  })

  it("uses the active locale's separators", () => {
    i18n.activate('de')
    expect(formatDecimal('1234567.89')).toBe('1.234.567,89')
  })
})
