import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Validate that a URL is safe to use as an `<a href>` value. Returns the
 * URL unchanged when the protocol is `http:` or `https:`; returns `null`
 * for anything else (`javascript:`, `data:`, `vbscript:`, malformed, …).
 *
 * Defence against XSS via untrusted user-controlled URLs:
 *   - validator `description.website` (anyone can register a validator
 *     with `javascript:alert(...)` as their website)
 *   - cosmos.directory registry `account_page` / `tx_page` templates
 *     (community-curated but defence in depth)
 *   - custom-endpoint explorer-base URLs set by the user (the user can
 *     attack themselves but no reason to let them)
 *
 * Callers should treat `null` as "render plain text, no link" rather
 * than rendering the unsafe URL.
 */
export function safeExternalUrl(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    const parsed = new URL(url)
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return url
    }
    return null
  } catch {
    return null
  }
}
