import { toHex } from '@cosmjs/encoding'
import { type IndexedTx } from '@cosmjs/stargate'
import { Comet38Client } from '@cosmjs/tendermint-rpc'

// ---------------------------------------------------------------------------
// Shared paginated tx_search helper
// ---------------------------------------------------------------------------
// cosmjs's `StargateClient.searchTx(query)` paginates internally — it loops
// through every page of results and returns them all. For addresses with
// thousands of matching txs (heavy IBC users, validator accounts, the
// big enterprise account, etc.) this is slow AND wastes bandwidth showing
// rows the user will never scroll to.
//
// `Comet38Client.txSearch({ query, page, per_page })` is the low-level RPC
// that supports proper cursor-based paging. This helper wraps it with a
// stable result shape: `{ txs: IndexedTx[], totalCount, hasMore }` where
// `txs` matches `IndexedTx` (the shape `StargateClient.searchTx` returns) so
// downstream code is interchangeable between the paged + un-paged variants.
// ---------------------------------------------------------------------------

/** Page size — 25 strikes a balance between RPC latency and number of
 * "Load more" clicks for a typical history view. */
export const TX_SEARCH_PAGE_SIZE = 25

export interface TxSearchPage {
  txs: IndexedTx[]
  totalCount: number
  /** True when this page's offset + size is less than `totalCount`, i.e.
   * there are more txs to fetch. The consumer's `getNextPageParam`
   * returns `nextPage` when this is true, `undefined` otherwise. */
  hasMore: boolean
  /** The 1-based page number this result represents. */
  page: number
}

/** Single attribute filter — `tx_search` requires `key='value'` ANDed. */
export interface TxSearchAttr {
  key: string
  value: string
}

/**
 * Fetch one page of tx_search results for the given `attrs` (joined by AND).
 * Returns `IndexedTx[]` shape-compatible with `StargateClient.searchTx`.
 *
 * `order_by: 'desc'` sorts newest-first at the RPC level, so the first page
 * is the most recent activity (matches block-explorer convention + what users
 * expect when paginating a history view).
 */
export async function txSearchPage(
  rpc: string,
  attrs: readonly TxSearchAttr[],
  page: number,
): Promise<TxSearchPage> {
  if (attrs.length === 0) {
    return { txs: [], totalCount: 0, hasMore: false, page }
  }
  const query = attrs.map((a) => `${a.key}='${a.value}'`).join(' AND ')
  const cometClient = await Comet38Client.connect(rpc)
  try {
    const res = await cometClient.txSearch({
      query,
      page,
      per_page: TX_SEARCH_PAGE_SIZE,
      prove: false,
      order_by: 'desc',
    })
    // cosmjs's `Uint8Array<ArrayBuffer>` generic confuses typescript-eslint's
    // typed-rule narrowing (same friction as in seeds.ts / vault-keystore /
    // txhistory.ts — the runtime shape is correct, the typed-lint just can't
    // prove it). Suppress the unsafe-argument / unsafe-assignment errors on
    // `tx.hash` / `tx.tx` for this block.
    /* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment */
    const txs: IndexedTx[] = res.txs.map((tx) => ({
      hash: toHex(tx.hash).toUpperCase(),
      height: tx.height,
      txIndex: tx.index,
      code: tx.result.code,
      events: tx.result.events,
      rawLog: tx.result.log ?? '',
      tx: tx.tx,
      gasUsed: BigInt(tx.result.gasUsed),
      gasWanted: BigInt(tx.result.gasWanted),
      // `msgResponses` is required on cosmjs's IndexedTx — empty array is the
      // accurate shape for our consumers (presenters look at events, not
      // msgResponses; ack/timeout lookups don't use it either). cosmjs's own
      // `StargateClient.searchTx` populates this from the raw response when
      // available, but Tendermint v0.38 doesn't surface decoded responses at
      // this level so the array stays empty either way.
      msgResponses: [],
    }))
    /* eslint-enable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment */
    const hasMore = page * TX_SEARCH_PAGE_SIZE < res.totalCount
    return { txs, totalCount: res.totalCount, hasMore, page }
  } finally {
    cometClient.disconnect()
  }
}
