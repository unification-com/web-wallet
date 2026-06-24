import { describe, expect, it } from 'vitest'

import { safeExternalUrl } from './utils'

describe('utils.safeExternalUrl', () => {
  it('passes through https URLs', () => {
    expect(safeExternalUrl('https://explorer.unification.io/u/tx/ABC')).toBe(
      'https://explorer.unification.io/u/tx/ABC',
    )
  })

  it('passes through http URLs', () => {
    expect(safeExternalUrl('http://localhost:26657')).toBe('http://localhost:26657')
  })

  it('rejects javascript: URLs', () => {
    expect(safeExternalUrl('javascript:alert(1)')).toBeNull()
    expect(safeExternalUrl('JaVaScRiPt:alert(1)')).toBeNull()
  })

  it('rejects data: URLs', () => {
    expect(
      safeExternalUrl('data:text/html,<script>alert(1)</script>'),
    ).toBeNull()
  })

  it('rejects vbscript: URLs', () => {
    expect(safeExternalUrl('vbscript:msgbox')).toBeNull()
  })

  it('rejects file: URLs', () => {
    expect(safeExternalUrl('file:///etc/passwd')).toBeNull()
  })

  it('rejects malformed URLs', () => {
    expect(safeExternalUrl('not a url')).toBeNull()
    expect(safeExternalUrl('//missing-scheme.example')).toBeNull()
  })

  it('rejects null / undefined / empty', () => {
    expect(safeExternalUrl(null)).toBeNull()
    expect(safeExternalUrl(undefined)).toBeNull()
    expect(safeExternalUrl('')).toBeNull()
  })

  it('rejects whitespace-padded javascript: URLs', () => {
    // URL constructor strips leading control characters in some browsers
    // but a defensive parse still lands the protocol as `javascript:`.
    expect(safeExternalUrl('  javascript:alert(1)')).toBeNull()
  })

  it('preserves query strings + fragments on http(s)', () => {
    const url = 'https://example.com/path?a=1&b=2#frag'
    expect(safeExternalUrl(url)).toBe(url)
  })
})
