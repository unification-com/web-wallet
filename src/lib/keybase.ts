import { useQuery } from '@tanstack/react-query'

// ---------------------------------------------------------------------------
// Keybase avatar lookup by Cosmos validator `identity` field
// ---------------------------------------------------------------------------
// Cosmos validators advertise a 16-hex-char Keybase identity in their
// `description.identity` field. Keybase exposes a public `lookup.json`
// API that resolves the identity to the validator's profile picture (the
// canonical avatar source across Cosmos explorers + wallets).
//
// API: `GET https://keybase.io/_/api/1.0/user/lookup.json?key_suffix=<id>&fields=pictures`
// Response shape (relevant slice):
//   { status: { code: 0, ... }, them: [{ pictures: { primary: { url: "..." } } }] }
// Notes:
//   - `them` is `[null]` (length-1 array with null entry) for unknown ids.
//   - `pictures` is absent when the user hasn't uploaded an avatar.
//   - The `url` is an S3 link that's stable enough for `<img src>` to load
//     without CORS — image loads in MV3 don't require host_permissions for
//     the S3 host (only fetch/XHR do, which is just the lookup itself).
//
// `host_permissions: ["https://keybase.io/*"]` declared in manifest.json
// so the extension can fetch from this host.
// ---------------------------------------------------------------------------

/**
 * Loose validator for the Keybase identity field. Real identities are
 * exactly 16 hex characters (the suffix of the user's PGP fingerprint),
 * but we allow 8-32 hex to tolerate older / non-standard advertisements.
 */
const KEYBASE_IDENTITY_RE = /^[0-9a-fA-F]{8,32}$/

interface KeybaseLookupResponse {
  status?: { code?: number }
  them?: (KeybaseUser | null)[]
}

interface KeybaseUser {
  pictures?: { primary?: { url?: string } }
}

/**
 * Resolve a validator's Keybase `identity` to an avatar URL. Returns
 * `null` when:
 *   - identity is empty / malformed
 *   - lookup returns no user (deleted account, never existed)
 *   - user has no `pictures.primary.url` (Keybase account with no avatar)
 *   - network failure (we don't surface errors — fallback UI shows
 *     initials or hides the avatar slot)
 *
 * Cached for 7 days — avatars change rarely + the cache amortises
 * across popup re-opens on the same identity.
 */
export function useKeybaseAvatar(identity: string | undefined) {
  const enabled = !!identity && KEYBASE_IDENTITY_RE.test(identity)
  return useQuery({
    queryKey: ['keybase', 'avatar', identity ?? ''],
    queryFn: async (): Promise<string | null> => {
      if (!identity) return null
      const url = `https://keybase.io/_/api/1.0/user/lookup.json?key_suffix=${encodeURIComponent(
        identity,
      )}&fields=pictures`
      try {
        const res = await fetch(url)
        if (!res.ok) return null
        const body = (await res.json()) as KeybaseLookupResponse
        if (body.status?.code !== 0) return null
        const user = body.them?.[0]
        if (!user) return null
        return user.pictures?.primary?.url ?? null
      } catch {
        return null
      }
    },
    enabled,
    staleTime: 7 * 24 * 60 * 60_000, // 7 days
    refetchInterval: false,
    retry: false,
  })
}
