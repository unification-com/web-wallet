import { describe, expect, it } from 'vitest'

import { formatRelativeDeadline, timestampToDate } from './time'

const NOW = new Date('2026-05-21T12:00:00Z')

describe('time.formatRelativeDeadline', () => {
  it('returns a placeholder for undefined targets', () => {
    const r = formatRelativeDeadline(undefined, NOW)
    expect(r.label).toBe('—')
    expect(r.complete).toBe(false)
  })

  it('picks seconds for sub-minute deltas', () => {
    const target = new Date(NOW.getTime() + 30_000)
    const r = formatRelativeDeadline(target, NOW, 'en')
    expect(r.complete).toBe(false)
    expect(r.label).toMatch(/seconds?|now/)
  })

  it('picks minutes for sub-hour deltas', () => {
    const target = new Date(NOW.getTime() + 5 * 60_000)
    const r = formatRelativeDeadline(target, NOW, 'en')
    expect(r.label).toMatch(/minute/)
  })

  it('picks hours for sub-day deltas', () => {
    const target = new Date(NOW.getTime() + 5 * 3_600_000)
    const r = formatRelativeDeadline(target, NOW, 'en')
    expect(r.label).toMatch(/hour/)
  })

  it('picks days for multi-day deltas (typical 21-day unbonding)', () => {
    const target = new Date(NOW.getTime() + 21 * 86_400_000)
    const r = formatRelativeDeadline(target, NOW, 'en')
    expect(r.label).toMatch(/day/)
    expect(r.label).toMatch(/21/)
  })

  it('flags completion when the target is in the past', () => {
    const target = new Date(NOW.getTime() - 60_000)
    const r = formatRelativeDeadline(target, NOW, 'en')
    expect(r.complete).toBe(true)
  })

  it('flags completion exactly at the boundary', () => {
    const r = formatRelativeDeadline(NOW, NOW, 'en')
    expect(r.complete).toBe(true)
  })

  it('uses the numeric:auto path for special cases (tomorrow/yesterday)', () => {
    // 23h is rounded up to 1 day by the hour branch when absSeconds >= 86_400,
    // but 26h is squarely a day. Spot-check.
    const target = new Date(NOW.getTime() + 26 * 3_600_000)
    const r = formatRelativeDeadline(target, NOW, 'en')
    // numeric:'auto' may emit "tomorrow" for 1-day deltas — accept either form.
    expect(r.label).toMatch(/tomorrow|day/)
  })
})

describe('time.timestampToDate', () => {
  it('returns undefined for missing / zero timestamps', () => {
    expect(timestampToDate(undefined)).toBeUndefined()
    expect(timestampToDate({ seconds: 0n, nanos: 0 })).toBeUndefined()
  })

  it('converts proto Timestamp to JS Date at millisecond resolution', () => {
    const target = new Date('2026-05-21T12:00:00.500Z')
    const seconds = BigInt(Math.floor(target.getTime() / 1000))
    const nanos = (target.getMilliseconds() % 1000) * 1_000_000
    const d = timestampToDate({ seconds, nanos })
    expect(d).toBeDefined()
    expect(d!.toISOString()).toBe('2026-05-21T12:00:00.500Z')
  })

  it('drops sub-millisecond precision (floor)', () => {
    const ts = { seconds: 0n, nanos: 999_999 } // 0.999999 ms → 0 ms
    expect(timestampToDate(ts)!.getTime()).toBe(0)
  })

  it('passes a Date input through unchanged (some cosmjs paths pre-coerce)', () => {
    const d = new Date('2026-05-21T12:00:00Z')
    expect(timestampToDate(d)).toBe(d)
  })
})
