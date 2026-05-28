import { decodeTxRaw, type DecodedTxRaw } from '@cosmjs/proto-signing'
import { StargateClient, type IndexedTx } from '@cosmjs/stargate'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'

import { useActiveEndpoint } from './chain'
import { txSearchPage, TX_SEARCH_PAGE_SIZE } from './txsearchPaginated'

// ---------------------------------------------------------------------------
// Module note
// ---------------------------------------------------------------------------
// Tendermint `tx_search` supports `AND` but not `OR`, so we run a handful of
// queries per page and union them client-side. Each query is cursor-paged
// via `txSearchPage` — clicking "Load more" fetches the next page from
// every direction in parallel.
//
// The four directions:
//   1. `message.sender = address` — Txs the user signed (covers MsgSend,
//      MsgDelegate, MsgGrant the user gave, MsgExec the user did, …).
//   2. `transfer.recipient = address` — Bank transfers received.
//   3. `cosmos.authz.v1beta1.EventGrant.grantee = address` — Grants RECEIVED
//      (the granter signed; the user is named as the grantee). Without this
//      the user wouldn't see authz grants made FOR them.
//   4. `cosmos.authz.v1beta1.EventRevoke.grantee = address` — Revokes
//      received (symmetric to #3).
//
// MsgExec on the user's behalf (grantee runs a Msg for the user) is
// covered by #1 from the grantee's side; the granter doesn't sign, so it
// won't appear in their history — that's correct, the granter isn't on the
// transaction. The receive-side bank credit from the inner Msg shows up
// via #2 if it was a transfer.
// ---------------------------------------------------------------------------

/**
 * A tx as we surface it in the UI — the raw `IndexedTx` from cosmjs plus
 * the proto-decoded body (so presenters don't each redo the decode).
 */
export interface DecodedIndexedTx extends IndexedTx {
  /** Proto-decoded `TxRaw` — `.body.messages` is `Any[]`. */
  decoded: DecodedTxRaw
}

/**
 * Dedupe-by-hash + sort-by-height-desc helper. Pure for testability; the
 * hook below wraps it after concatenating sent + received query results.
 */
export function mergeTxLists(
  ...lists: readonly (readonly IndexedTx[])[]
): IndexedTx[] {
  const seen = new Set<string>()
  const merged: IndexedTx[] = []
  for (const list of lists) {
    for (const tx of list) {
      if (seen.has(tx.hash)) continue
      seen.add(tx.hash)
      merged.push(tx)
    }
  }
  // Newest first. Same-height ties break on txIndex (descending so the last
  // tx in the block sorts first — matches block-explorer convention).
  merged.sort((a, b) => {
    if (a.height !== b.height) return b.height - a.height
    return b.txIndex - a.txIndex
  })
  return merged
}

/**
 * Hydrate raw `IndexedTx[]` with decoded TxRaw bodies. Decoding is
 * synchronous (BinaryReader-based) so doing it eagerly here keeps the
 * render path pure.
 */
function hydrate(txs: readonly IndexedTx[]): DecodedIndexedTx[] {
  return txs.map((tx) => ({
    ...tx,
    // Cast: `IndexedTx.tx` is `Uint8Array<ArrayBuffer>` while
    // `decodeTxRaw` accepts `Uint8Array` — the cast strips the type
    // parameter without changing the runtime value.
    decoded: decodeTxRaw(tx.tx as Uint8Array),
  }))
}

export interface TxHistoryPage {
  txs: DecodedIndexedTx[]
  page: number
  hasMore: boolean
  /** Sum of total_count across both directions — `hasMore` is the better
   * "should we show the Load more button" signal but `totalCount` is useful
   * for "showing X of N" copy if surfaced. */
  totalCount: number
}

/**
 * Cursor-paginated tx history for `address`. Use `data.pages.flatMap(p => p.txs)`
 * to render the full flattened list, or iterate `data.pages` to render per-
 * page sections. Call `fetchNextPage()` when the user clicks "Load more".
 *
 * Each page fetches page N of four parallel queries (see module note),
 * then merges + dedupes. With `TX_SEARCH_PAGE_SIZE = 25`, that's up to
 * 100 fresh txs per "Load more" click in the heavy-user case — but the
 * dedupe + height-sort collapses overlap correctly.
 */
export function useTxHistory(address: string | null) {
  const endpoint = useActiveEndpoint()
  return useInfiniteQuery<TxHistoryPage>({
    queryKey: ['txhistory', endpoint.id, address],
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      const page = pageParam as number
      if (!address) {
        return { txs: [], page, hasMore: false, totalCount: 0 }
      }
      const [sent, received, grantsReceived, revokesReceived] = await Promise.all([
        txSearchPage(endpoint.rpc, [{ key: 'message.sender', value: address }], page),
        txSearchPage(endpoint.rpc, [{ key: 'transfer.recipient', value: address }], page),
        txSearchPage(
          endpoint.rpc,
          [{ key: 'cosmos.authz.v1beta1.EventGrant.grantee', value: address }],
          page,
        ),
        txSearchPage(
          endpoint.rpc,
          [{ key: 'cosmos.authz.v1beta1.EventRevoke.grantee', value: address }],
          page,
        ),
      ])
      const merged = mergeTxLists(
        sent.txs,
        received.txs,
        grantsReceived.txs,
        revokesReceived.txs,
      )
      return {
        txs: hydrate(merged),
        page,
        hasMore:
          sent.hasMore ||
          received.hasMore ||
          grantsReceived.hasMore ||
          revokesReceived.hasMore,
        totalCount:
          sent.totalCount +
          received.totalCount +
          grantsReceived.totalCount +
          revokesReceived.totalCount,
      }
    },
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    enabled: !!address,
    refetchInterval: 30_000,
  })
}

/**
 * Single-tx lookup by hash. Useful for deep-link / detail-view paths.
 * Hash is the upper-case hex form (`StargateClient.getTx` accepts that).
 */
export function useTx(hash: string | null) {
  const endpoint = useActiveEndpoint()
  return useQuery({
    queryKey: ['tx', endpoint.id, hash],
    queryFn: async (): Promise<DecodedIndexedTx | null> => {
      if (!hash) return null
      const client = await StargateClient.connect(endpoint.rpc)
      try {
        const tx = await client.getTx(hash)
        if (!tx) return null
        return { ...tx, decoded: decodeTxRaw(tx.tx as Uint8Array) }
      } finally {
        client.disconnect()
      }
    },
    enabled: !!hash,
  })
}

/** Re-export for consumers building "showing X of Y" UI. */
export { TX_SEARCH_PAGE_SIZE }
