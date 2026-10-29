import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// The runtime import of `QueryClientImpl` in `./stream` pulls in fundjs-react's
// CJS dist, which in turn `require()`s `@tanstack/react-query` from the
// symlinked `link:` location — Node CJS can't walk that symlink back to the
// host node_modules. Stub the module so the import resolves; the pure helpers
// under test don't touch the class.
vi.mock('@unification-com/fundjs-react/mainchain/stream/v1/query.rpc.Query', () => ({
  QueryClientImpl: class {},
}))

const { claimableNow, depositRemainingMs, formatFlowRate, sortStreams } = await import('./stream')
type Stream = import('./stream').Stream
type StreamResult = import('./stream').StreamResult

const FIXED_NOW = new Date('2026-06-01T00:00:00Z')

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(FIXED_NOW)
})

afterEach(() => {
  vi.useRealTimers()
})

function mkStream(opts: {
  flowRate: bigint
  depositAmount: string
  depositDenom?: string
  lastOutflowOffsetSec: number
  depositZeroOffsetSec: number
  cancellable?: boolean
}): Stream {
  return {
    deposit: {
      denom: opts.depositDenom ?? 'nund',
      amount: opts.depositAmount,
    },
    flowRate: opts.flowRate,
    lastOutflowTime: new Date(FIXED_NOW.getTime() + opts.lastOutflowOffsetSec * 1000),
    depositZeroTime: new Date(FIXED_NOW.getTime() + opts.depositZeroOffsetSec * 1000),
    cancellable: opts.cancellable ?? true,
  }
}

function mkResult(stream: Stream, receiver = 'und1rcv', sender = 'und1snd'): StreamResult {
  return {
    receiver,
    sender,
    stream,
    denom: stream.deposit.denom,
  }
}

describe('depositRemainingMs', () => {
  it('returns positive ms when deposit-zero is in the future', () => {
    const s = mkStream({
      flowRate: 100n,
      depositAmount: '1000000',
      lastOutflowOffsetSec: -60,
      depositZeroOffsetSec: 3600,
    })
    expect(depositRemainingMs(s)).toBe(3_600_000)
  })

  it('returns negative ms once the deposit has drained', () => {
    const s = mkStream({
      flowRate: 100n,
      depositAmount: '0',
      lastOutflowOffsetSec: -3600,
      depositZeroOffsetSec: -60,
    })
    expect(depositRemainingMs(s)).toBe(-60_000)
  })

  it('returns null when stream is undefined', () => {
    expect(depositRemainingMs(undefined)).toBeNull()
  })
})

describe('claimableNow', () => {
  it('returns flowRate × elapsed seconds when below deposit cap', () => {
    const s = mkStream({
      flowRate: 100n,
      depositAmount: '1000000',
      lastOutflowOffsetSec: -60,
      depositZeroOffsetSec: 3600,
    })
    // 60 s × 100 nund/s = 6000
    expect(claimableNow(s)).toBe(6_000n)
  })

  it('caps at remaining deposit when stream has drained', () => {
    const s = mkStream({
      flowRate: 1_000n,
      depositAmount: '5000',
      lastOutflowOffsetSec: -3600,
      depositZeroOffsetSec: -3000,
    })
    // 3600 s × 1000 nund/s = 3,600,000 — capped at deposit 5000
    expect(claimableNow(s)).toBe(5_000n)
  })

  it('returns 0n when stream is undefined', () => {
    expect(claimableNow(undefined)).toBe(0n)
  })

  it('returns 0n when last outflow is in the future (clock skew defence)', () => {
    const s = mkStream({
      flowRate: 100n,
      depositAmount: '1000000',
      lastOutflowOffsetSec: 60,
      depositZeroOffsetSec: 3600,
    })
    expect(claimableNow(s)).toBe(0n)
  })
})

describe('formatFlowRate', () => {
  it('picks sec for high-rate streams (≥ 1 FUND/sec)', () => {
    expect(formatFlowRate(1_000_000_000n)).toEqual({ amountFund: '1', period: 'sec' })
  })

  it('picks min for ~1 FUND/min rates', () => {
    // 1 FUND/min = 1e9 / 60 ≈ 16,666,667 nund/sec
    const r = formatFlowRate(16_666_667n)
    expect(r.period).toBe('min')
  })

  it('picks hour for ~1 FUND/hour rates', () => {
    // 1 FUND/hour = 1e9 / 3600 ≈ 277,778 nund/sec
    const r = formatFlowRate(277_778n)
    expect(r.period).toBe('hour')
  })

  it('picks day for ~1 FUND/day rates', () => {
    // 1 FUND/day = 1e9 / 86400 ≈ 11,574 nund/sec — rounding down lands just
    // shy of the 1-FUND threshold, so use 12_000 to land cleanly in `day`.
    const r = formatFlowRate(12_000n)
    expect(r.period).toBe('day')
  })

  it('picks month for low rates ≥ 1 FUND/month', () => {
    // 1 FUND/month (30d) = 1e9 / 2_592_000 ≈ 386 nund/sec
    const r = formatFlowRate(386n)
    expect(r.period).toBe('month')
  })

  it('falls back to sec for dust-rate streams (< 1 FUND/month)', () => {
    expect(formatFlowRate(1n).period).toBe('sec')
  })
})

describe('sortStreams', () => {
  it('orders by claimable-now descending, then deposit-remaining descending', () => {
    const big = mkResult(
      mkStream({
        flowRate: 100n,
        depositAmount: '1000000',
        lastOutflowOffsetSec: -120,
        depositZeroOffsetSec: 7200,
      }),
      'und1rcv',
      'und1A',
    )
    const small = mkResult(
      mkStream({
        flowRate: 100n,
        depositAmount: '1000000',
        lastOutflowOffsetSec: -30,
        depositZeroOffsetSec: 1800,
      }),
      'und1rcv',
      'und1B',
    )
    const zero = mkResult(
      mkStream({
        flowRate: 100n,
        depositAmount: '0',
        lastOutflowOffsetSec: -300,
        depositZeroOffsetSec: -60,
      }),
      'und1rcv',
      'und1C',
    )
    const sorted = sortStreams([small, zero, big])
    expect(sorted.map((s) => s.sender)).toEqual(['und1A', 'und1B', 'und1C'])
  })

  it('returns a new array; does not mutate input', () => {
    const a = mkResult(
      mkStream({
        flowRate: 1n,
        depositAmount: '100',
        lastOutflowOffsetSec: -10,
        depositZeroOffsetSec: 60,
      }),
    )
    const input = [a]
    const sorted = sortStreams(input)
    expect(sorted).not.toBe(input)
  })
})
