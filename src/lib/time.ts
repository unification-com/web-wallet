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

/** Go's `time.Time.String()`: `2026-11-09 12:34:56.789012345 +0000 UTC`. */
const GO_TIME = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})(?:\.(\d+))? ([+-]\d{2})(\d{2})\b/

/**
 * Parse a time from a chain event attribute. Modules write them in two
 * shapes: unix seconds (BEACON's `beacon_timestamp_submit_time`) and Go's
 * `time.Time.String()` (x/stream's `deposit_zero_time`). Returns
 * `undefined` for anything else so the caller can show the raw value.
 */
export function parseChainTime(value: string): Date | undefined {
  if (/^\d+$/.test(value)) return new Date(Number(value) * 1000)
  const m = GO_TIME.exec(value)
  if (!m) return undefined
  const [, date, time, frac = '', tzHours, tzMinutes] = m
  const ms = frac.padEnd(3, '0').slice(0, 3)
  const parsed = new Date(`${date}T${time}.${ms}${tzHours}:${tzMinutes}`)
  return Number.isNaN(parsed.getTime()) ? undefined : parsed
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
 * The largest sensible unit for a span of `seconds` (sign kept, value not
 * rounded). Shared by the relative-deadline and duration formatters so the
 * two always agree on when a span reads as minutes, hours or days.
 */
function largestTimeUnit(seconds: number): { value: number; unit: 'second' | 'minute' | 'hour' | 'day' } {
  const abs = Math.abs(seconds)
  if (abs < 60) return { value: seconds, unit: 'second' }
  if (abs < 3600) return { value: seconds / 60, unit: 'minute' }
  if (abs < 86_400) return { value: seconds / 3600, unit: 'hour' }
  return { value: seconds / 86_400, unit: 'day' }
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
  const { value, unit } = largestTimeUnit(diffMs / 1000)
  return { label: fmt.format(Math.round(value), unit), complete: diffMs <= 0 }
}

/**
 * A length of time in words for the locale, in its largest sensible unit:
 * `604800` → "7 days", `5400` → "1.5 hours". Pluralisation comes from the
 * platform (`Intl.NumberFormat` unit style), so there are no catalogue
 * strings to translate.
 */
export function formatDuration(seconds: number, locale = 'en'): string {
  const { value, unit } = largestTimeUnit(seconds)
  return new Intl.NumberFormat(locale, { style: 'unit', unit, unitDisplay: 'long', maximumFractionDigits: 1 }).format(value)
}
