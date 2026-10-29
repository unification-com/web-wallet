import { i18n } from '@lingui/core'

/**
 * Divide `amount` (raw integer string) by 10^`decimals`, trimming trailing
 * zeros in the fractional part. BigInt-precision so foreign-chain tokens
 * with `decimals=18` (Ethereum-style) round-trip without precision loss.
 * Returns `'0'` on unparseable input.
 */
export function scaleByDecimals(amount: string, decimals: number): string {
  if (decimals <= 0) return amount
  try {
    const intPart = amount.split('.')[0] ?? '0'
    const big = BigInt(intPart)
    const scale = 10n ** BigInt(decimals)
    const whole = big / scale
    const frac = (big % scale).toString().padStart(decimals, '0').replace(/0+$/, '')
    return frac ? `${whole.toString()}.${frac}` : whole.toString()
  } catch {
    return '0'
  }
}

/** Digit-group and decimal separators per locale, read once from `Intl`. */
const separatorCache = new Map<string, { group: string; decimal: string }>()

function separatorsFor(locale: string): { group: string; decimal: string } {
  let separators = separatorCache.get(locale)
  if (!separators) {
    const parts = new Intl.NumberFormat(locale).formatToParts(11111.1)
    separators = {
      group: parts.find((p) => p.type === 'group')?.value ?? ',',
      decimal: parts.find((p) => p.type === 'decimal')?.value ?? '.',
    }
    separatorCache.set(locale, separators)
  }
  return separators
}

/**
 * Group the digits of a plain decimal string for display, using the active
 * locale's separators — `'20000000.1234567'` → `'20,000,000.1234567'` in `en`.
 * Works on the string itself rather than a JS number, which would round
 * anything past ~16 significant digits. Display only: never feed the result
 * back into a form input or into arithmetic. Anything that is not a plain
 * decimal string is returned unchanged.
 */
export function formatDecimal(value: string): string {
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(value)
  if (!match) return value
  const [, sign, whole, frac] = match
  const { group, decimal } = separatorsFor(i18n.locale || 'en')
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, group)
  return frac ? `${sign}${grouped}${decimal}${frac}` : `${sign}${grouped}`
}
