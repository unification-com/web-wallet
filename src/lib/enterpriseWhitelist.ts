import { useQuery } from '@tanstack/react-query'

import { useActiveEndpoint } from './chain'

// ---------------------------------------------------------------------------
// Lightweight enterprise-whitelist check (REST, no fundjs-react)
// ---------------------------------------------------------------------------
// The full enterprise query layer in `lib/enterprise.ts` is heavy (telescope-
// generated QueryClientImpl + all 9 enterprise queries + types) and lives
// inside the lazy `Enterprise` chunk. The App-level tab-gate needs the
// whitelist answer eagerly — without this lightweight REST variant the
// tab-gate import would pull the whole enterprise module into the eager
// bootstrap bundle.
//
// `/mainchain/enterprise/v1/whitelist/{address}` returns
// `{ address: string, whitelisted: boolean }` — verified against v1.12.0
// REST gateway. Tiny payload, no proto decoding.
// ---------------------------------------------------------------------------

interface WhitelistedResponse {
  address: string
  whitelisted: boolean
}

/**
 * Tab-gate whitelist check for `address` against the active endpoint's REST
 * gateway. Returns `boolean | undefined` — `undefined` while loading or if
 * REST is unavailable, treated by callers as "hide the tab (deny by default)".
 *
 * Cached aggressively (5 min staleTime) — whitelist changes are
 * governance / admin-tool driven, not user-facing.
 */
export function useIsWhitelistedLite(address: string | null) {
  const endpoint = useActiveEndpoint()
  return useQuery({
    queryKey: ['enterprise-lite', 'whitelisted', endpoint.id, address],
    queryFn: async (): Promise<boolean> => {
      if (!address) return false
      const url = `${endpoint.rest}/mainchain/enterprise/v1/whitelist/${address}`
      const res = await fetch(url)
      if (!res.ok) {
        // 4xx/5xx — most likely "not found" or REST not exposed. Treat as
        // not-whitelisted (deny by default) rather than crashing the app.
        return false
      }
      const body = (await res.json()) as WhitelistedResponse
      return body.whitelisted === true
    },
    enabled: !!address,
    staleTime: 5 * 60_000,
    refetchInterval: false,
  })
}
