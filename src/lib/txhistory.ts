import { decodeTxRaw, type DecodedTxRaw } from '@cosmjs/proto-signing'
import { StargateClient, type IndexedTx } from '@cosmjs/stargate'
import { useQuery } from '@tanstack/react-query'

import { useActiveEndpoint } from './chain'

// ---------------------------------------------------------------------------
// Module note
// ---------------------------------------------------------------------------
// cosmjs's `StargateClient.searchTx` calls the Tendermint `tx_search` RPC
// underneath, which supports an `AND`-only query language (no `OR`). To
// fetch every tx the active account is involved in, we run two queries
// (sent + received) and merge + dedupe by hash. searchTx internally pages
// through ALL results — for long histories this is expensive; if mainnet
// experience surfaces real slowness, switch to a paged fetch (or move to
// the indexer pattern in a later milestone).
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

/**
 * Tx history for `address`: every tx where `address` is either the
 * `message.sender` (outbound) OR the `transfer.recipient` (inbound).
 * Refetches every 30 s while mounted; that's enough to surface new txs
 * shortly after they're indexed without hammering the RPC for a slow-
 * moving history view.
 */
export function useTxHistory(address: string | null) {
  const endpoint = useActiveEndpoint()
  return useQuery({
    queryKey: ['txhistory', endpoint.id, address],
    queryFn: async (): Promise<DecodedIndexedTx[]> => {
      if (!address) return []
      const client = await StargateClient.connect(endpoint.rpc)
      try {
        // Two queries (sender + recipient). tx_search supports AND but not
        // OR, so we union client-side. Each query returns all matching
        // pages — cap risk: very long histories pull a lot at once. If
        // that becomes a problem, swap for a paged variant.
        const [sent, received] = await Promise.all([
          client.searchTx([{ key: 'message.sender', value: address }]),
          client.searchTx([{ key: 'transfer.recipient', value: address }]),
        ])
        return hydrate(mergeTxLists(sent, received))
      } finally {
        client.disconnect()
      }
    },
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
