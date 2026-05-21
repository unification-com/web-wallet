import { describe, expect, it } from 'vitest'

import { formatRelativeDeadline } from './time'

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
