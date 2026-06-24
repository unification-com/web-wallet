import { useLingui } from '@lingui/react/macro'
import { ExternalLink } from 'lucide-react'
import type { MouseEvent } from 'react'

import { accountExplorerUrl, useActiveEndpoint, validatorExplorerUrl } from '@/lib/chain'
import { safeExternalUrl } from '@/lib/utils'

/**
 * Render a bech32 address with truncation, copy-on-hover title, and (when
 * the active endpoint advertises an explorer base) a clickable deep-link to
 * the account or validator page.
 *
 * Single DRY surface for every "show an address" site in the wallet:
 *   - account addresses (`und1…`)            — `accountExplorerBase`
 *   - validator operator addresses (`undvaloper1…`) — `validatorExplorerBase`
 *   - foreign-chain addresses (`osmo1…` / `cosmos1…` etc.) when the caller
 *     resolves a remote-chain explorer URL via `url=…`. We never link
 *     foreign-prefix bech32 strings to the Unification explorer (would
 *     404).
 *
 * Falls back to plain monospace text whenever no URL is available — DevNet,
 * unsupported foreign chains, custom endpoints without an explorer set.
 *
 * Click is intentionally `stopPropagation`-ed so the link works even inside
 * an outer clickable row (e.g. a tx-row toggle).
 */

const VALOPER_PREFIX = 'undvaloper1'
const ACCOUNT_PREFIX = 'und1'

export type AddressKind = 'account' | 'validator'

export interface AddressLinkProps {
  /** Raw bech32 string. Required. */
  address: string
  /**
   * Force interpretation. When omitted, derived from the prefix:
   *   - `undvaloper1…` → 'validator'
   *   - everything else → 'account' (incl. foreign-chain prefixes; only
   *     linked when an explicit `url` is also supplied)
   */
  kind?: AddressKind
  /**
   * Optional pre-resolved explorer URL — wins over the endpoint-derived
   * default. Use for foreign-chain (IBC counterparty) addresses where the
   * cosmos.directory registry has provided the explorer template.
   */
  url?: string | null
  /** Display truncation. Default `true`. Pass `false` for full-width contexts. */
  truncate?: boolean
  /** Override default truncation head length (default 8). */
  truncateHead?: number
  /** Override default truncation tail length (default 6). */
  truncateTail?: number
  /** Hide the trailing external-link icon (saves space in compact rows). */
  hideIcon?: boolean
  /** Extra classes merged onto the rendered element. */
  className?: string
}

function truncateAddress(addr: string, head: number, tail: number): string {
  return addr.length <= head + tail + 1 ? addr : `${addr.slice(0, head)}…${addr.slice(-tail)}`
}

export function AddressLink({
  address,
  kind,
  url,
  truncate = true,
  truncateHead = 8,
  truncateTail = 6,
  hideIcon = false,
  className,
}: AddressLinkProps) {
  const endpoint = useActiveEndpoint()
  const { t } = useLingui()

  const effectiveKind: AddressKind = kind ?? (address.startsWith(VALOPER_PREFIX) ? 'validator' : 'account')

  // Endpoint-derived URL only applies for native Unification prefixes; a
  // foreign-prefix address (osmo1, cosmos1, …) without an explicit `url`
  // means "render plain text" — linking it to the Unification explorer
  // would 404.
  let candidateUrl: string | null = url ?? null
  if (candidateUrl === null) {
    if (effectiveKind === 'validator' && address.startsWith(VALOPER_PREFIX)) {
      candidateUrl = validatorExplorerUrl(endpoint, address)
    } else if (effectiveKind === 'account' && address.startsWith(ACCOUNT_PREFIX)) {
      candidateUrl = accountExplorerUrl(endpoint, address)
    }
  }
  // SECURITY: the `url` prop (passed for foreign-chain IBC counterparties)
  // is sourced from the cosmos.directory registry's account_page template
  // — community-curated but defence in depth. Custom endpoints'
  // accountExplorerBase / validatorExplorerBase are user-supplied. Either
  // surface could carry a `javascript:` URL that would execute in the
  // extension context on click. Strip to http(s) only; null falls through
  // to the plain-text render below.
  const resolvedUrl = safeExternalUrl(candidateUrl)

  const display = truncate ? truncateAddress(address, truncateHead, truncateTail) : address
  const mergedClass = `font-mono ${className ?? ''}`.trim()

  if (!resolvedUrl) {
    return (
      <span className={mergedClass} title={address}>
        {display}
      </span>
    )
  }

  const stopBubble = (event: MouseEvent<HTMLAnchorElement>) => {
    event.stopPropagation()
  }

  // Layout split:
  //  - truncate=true (default): inline-flex keeps the address + icon on a
  //    single line; the inner span carries `truncate` (overflow-hidden +
  //    text-ellipsis + nowrap) so it clips inside its flex parent.
  //  - truncate=false: render inline with `break-all` so long bech32
  //    strings actually wrap inside narrow containers (popup-width
  //    receive view, validator detail panel). Using `inline-flex +
  //    nowrap` here would force the address onto one line and overflow
  //    the container — the original bug.
  return truncate ? (
    <a
      href={resolvedUrl}
      target="_blank"
      rel="noopener noreferrer"
      onClick={stopBubble}
      className={`${mergedClass} text-primary hover:underline inline-flex items-center gap-1`}
      title={`${address} — ${t`Open in block explorer`}`}
    >
      <span className="truncate">{display}</span>
      {!hideIcon && <ExternalLink className="h-3 w-3 shrink-0" />}
    </a>
  ) : (
    <a
      href={resolvedUrl}
      target="_blank"
      rel="noopener noreferrer"
      onClick={stopBubble}
      className={`${mergedClass} text-primary hover:underline break-all`}
      title={`${address} — ${t`Open in block explorer`}`}
    >
      {display}
      {!hideIcon && (
        <ExternalLink className="h-3 w-3 inline-block align-baseline ml-0.5 shrink-0" />
      )}
    </a>
  )
}
