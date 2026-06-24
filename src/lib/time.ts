import { useEffect, useState } from 'react'

/** Proto `google.protobuf.Timestamp` shape (cosmjs-types). */
export interface ProtoTimestamp {
  seconds: bigint
  nanos: number
}

/**
 * Convert a cosmjs-decoded proto `Timestamp` to a JS `Date`. Returns
 * `undefined` for missing / zero timestamps (the proto default-init shape).
 * Nanosecond precision is dropped — JS `Date` is millisecond resolution.
 *
 * Also accepts `Date` inputs verbatim — some cosmjs query paths (e.g.
 * `setupStakingExtension`'s wrapper) hand-roll the Timestamp → Date
 * conversion before returning, while others (`Comet38Client.txSearch`'s
 * raw decode) leave the proto shape intact. Accepting both keeps every
 * consumer agnostic to which path produced the value.
 */
export function timestampToDate(
  ts: ProtoTimestamp | Date | undefined,
): Date | undefined {
  if (!ts) return undefined
  if (ts instanceof Date) return ts
  if (ts.seconds === 0n && ts.nanos === 0) return undefined
  const ms = Number(ts.seconds) * 1000 + Math.floor(ts.nanos / 1_000_000)
  return new Date(ms)
}

/**
 * Re-render the consumer every `intervalMs` so visible deadline countdowns
 * (unbonding entries, redelegation entries) refresh without a full data
 * refetch. Cheap — single `setInterval` + one piece of component-local
 * state.
 */
export function useTickingNow(intervalMs = 60_000): Date {
  const [now, setNow] = useState<Date>(() => new Date())
  useEffect(() => {
    const handle = setInterval(() => setNow(new Date()), intervalMs)
    return () => clearInterval(handle)
  }, [intervalMs])
  return now
}

/** Result of {@link formatRelativeDeadline}. */
export interface RelativeDeadline {
  /** Locale-formatted relative label, e.g. "in 14 days", "tomorrow", "5 minutes ago". */
  label: string
  /** True when `target` is at or before `now`. */
  complete: boolean
}

/**
 * Picks the largest sensible time unit for the gap between `target` and
 * `now`, then formats it via `Intl.RelativeTimeFormat` (locale-aware,
 * pluralisation handled by the platform). Returns `label: '—'` and
 * `complete: false` when `target` is undefined.
 *
 * Used by the in-flight queues to render "completes in X" countdowns;
 * crossing the boundary just flips `complete: true` and the caller can swap
 * to a "ready" badge.
 */
export function formatRelativeDeadline(
  target: Date | undefined,
  now: Date = new Date(),
  locale = 'en',
): RelativeDeadline {
  if (!target) return { label: '—', complete: false }
  const diffMs = target.getTime() - now.getTime()
  const fmt = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  const absSeconds = Math.abs(diffMs) / 1000

  let value: number
  let unit: Intl.RelativeTimeFormatUnit
  if (absSeconds < 60) {
    value = Math.round(diffMs / 1000)
    unit = 'second'
  } else if (absSeconds < 3600) {
    value = Math.round(diffMs / 60_000)
    unit = 'minute'
  } else if (absSeconds < 86_400) {
    value = Math.round(diffMs / 3_600_000)
    unit = 'hour'
  } else {
    value = Math.round(diffMs / 86_400_000)
    unit = 'day'
  }
  return { label: fmt.format(value, unit), complete: diffMs <= 0 }
}
