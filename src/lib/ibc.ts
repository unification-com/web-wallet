import {
  QueryClient,
  setupIbcExtension,
  StargateClient,
  type IndexedTx,
} from '@cosmjs/stargate'
import { Comet38Client } from '@cosmjs/tendermint-rpc'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { State as ChannelState } from 'cosmjs-types/ibc/core/channel/v1/channel'

import { useActiveEndpoint } from './chain'
import { txSearchPage } from './txsearchPaginated'

// ---------------------------------------------------------------------------
// Module note — IBC queries via cosmjs's bundled extension
// ---------------------------------------------------------------------------
// cosmjs's `setupIbcExtension` covers everything we need for the wallet's
// send + balance surfaces:
//   - `ibc.channel.channels()` — list every channel on the chain
//   - `ibc.channel.clientState(portId, channelId)` — resolves the channel's
//     counterparty CHAIN ID (e.g. "osmosis-1") via the light client state
//
// Denom-trace (`ibc/<hash>` → `{ path, base_denom }`) is in a different
// IBC sub-module (`applications/transfer`) which cosmjs doesn't expose in
// `setupIbcExtension`. We hit the REST endpoint directly for that —
// payload is small, no proto decoding, and the REST gateway has been
// stable on v1.12.0.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Channels
// ---------------------------------------------------------------------------

export interface IbcTransferChannel {
  /** Source-side channel ID — e.g. `"channel-0"`. Used as `source_channel`
   * in `MsgTransfer`. */
  channelId: string
  /** Always `"transfer"` for the channels we surface (we filter out other
   * ports — wallet only cares about token transfers). */
  portId: string
  /** Destination chain's chain ID — e.g. `"osmosis-1"`. Resolved via the
   * light client state behind the channel's connection. */
  counterpartyChainId: string
  /** Destination-side channel ID + port for display ("you'll arrive on
   * `channel-603` on the counterparty chain"). */
  counterpartyChannelId: string
}

async function makeIbcClient(rpc: string): Promise<{
  ibc: ReturnType<typeof setupIbcExtension>
  disconnect: () => void
}> {
  const cometClient = await Comet38Client.connect(rpc)
  const queryClient = QueryClient.withExtensions(cometClient, setupIbcExtension)
  return {
    ibc: queryClient,
    disconnect: () => cometClient.disconnect(),
  }
}

/**
 * All OPEN transfer-port IBC channels on the active chain, with the
 * counterparty chain ID resolved via the channel's light-client state.
 *
 * Two-stage fetch: list channels (1 query) + clientState per channel (N
 * queries in parallel). For Unification (currently 3 open channels) that's
 * 4 round-trips, all small payloads. Acceptable; cached aggressively
 * (60 min `staleTime`) since channels rarely change.
 *
 * Returns `[]` on RPC failure rather than throwing — the `<SendIbc />`
 * surface degrades gracefully to "no destinations available" if discovery
 * breaks, instead of taking the whole tab down.
 */
export function useIbcChannels() {
  const endpoint = useActiveEndpoint()
  return useQuery({
    queryKey: ['ibc', 'channels', endpoint.id],
    queryFn: async (): Promise<IbcTransferChannel[]> => {
      const { ibc, disconnect } = await makeIbcClient(endpoint.rpc)
      try {
        const channels = await ibc.ibc.channel.channels()
        const open = channels.channels.filter(
          (c) => c.state === ChannelState.STATE_OPEN && c.portId === 'transfer',
        )
        // Resolve counterparty chain ID + client status per channel in
        // parallel. STATE_OPEN alone isn't enough — the backing light
        // client may have expired (no relayer update within the trusting
        // period), in which case the channel can't actually pass packets.
        // The chain's `client_status` query is the canonical signal —
        // returns `"Active" | "Expired" | "Frozen" | "Unauthorized" | "Unknown"`.
        // We filter to `Active` so the dropdown reflects what's truly usable.
        const resolved = await Promise.all(
          open.map(async (c) => {
            try {
              const res = await ibc.ibc.channel.clientState(c.portId, c.channelId)
              const clientId = res.identifiedClientState?.clientId ?? ''
              if (!clientId) return null
              const [tm, status] = await Promise.all([
                ibc.ibc.client.stateTm(clientId),
                fetchClientStatus(endpoint.rest, clientId),
              ])
              if (status !== 'Active') return null
              return {
                channelId: c.channelId,
                portId: c.portId,
                counterpartyChainId: tm.chainId,
                counterpartyChannelId: c.counterparty?.channelId ?? '',
              } satisfies IbcTransferChannel
            } catch {
              return null
            }
          }),
        )
        return resolved.filter((c): c is IbcTransferChannel => c !== null)
      } finally {
        disconnect()
      }
    },
    // Channels are governance / relayer-managed — changes are rare. Client
    // expiry IS more dynamic (typical 14-day trusting period) but a 60-min
    // stale window is well below that, so we won't miss a freshly-expired
    // client by more than an hour.
    staleTime: 60 * 60_000, // 60 min
    refetchInterval: false,
  })
}

/** REST-only call — cosmjs's IBC extension doesn't expose `client_status`. */
async function fetchClientStatus(rest: string, clientId: string): Promise<string> {
  try {
    const res = await fetch(`${rest}/ibc/core/client/v1/client_status/${clientId}`)
    if (!res.ok) return 'Unknown'
    const body = (await res.json()) as { status?: string }
    return body.status ?? 'Unknown'
  } catch {
    return 'Unknown'
  }
}

// ---------------------------------------------------------------------------
// Denom traces (received IBC tokens)
// ---------------------------------------------------------------------------

export interface DenomTrace {
  /** Trace path — e.g. `"transfer/channel-0"`. Multi-hop traces appear as
   * `"transfer/channel-X/transfer/channel-Y"`. */
  path: string
  /** Source-chain native denom — e.g. `"uatom"` for ATOM via Cosmos Hub. */
  baseDenom: string
}

/**
 * Resolve an `ibc/<hash>` denom to its `{ path, base_denom }` by querying
 * the chain's REST endpoint `/ibc/apps/transfer/v1/denom_traces/{hash}`.
 * REST gives us a tiny JSON payload with no proto decoding — much simpler
 * than wiring the `ibc.applications.transfer.v1.Query` proto bindings
 * through cosmjs-types.
 *
 * Returns `null` if the hash isn't an IBC denom, the chain doesn't know
 * it, or REST is unavailable. Cached very aggressively (24h staleTime) —
 * denom hashes are content-addressed and never change once minted.
 */
export function useDenomTrace(denom: string | null) {
  const endpoint = useActiveEndpoint()
  const enabled = !!denom && denom.startsWith('ibc/')
  return useQuery({
    queryKey: ['ibc', 'denom-trace', endpoint.id, denom],
    queryFn: async (): Promise<DenomTrace | null> => {
      if (!denom?.startsWith('ibc/')) return null
      const hash = denom.slice(4) // strip leading "ibc/"
      const url = `${endpoint.rest}/ibc/apps/transfer/v1/denom_traces/${hash}`
      try {
        const res = await fetch(url)
        if (!res.ok) return null
        const body = (await res.json()) as { denom_trace?: { path: string; base_denom: string } }
        if (!body.denom_trace) return null
        return {
          path: body.denom_trace.path,
          baseDenom: body.denom_trace.base_denom,
        }
      } catch {
        return null
      }
    },
    enabled,
    staleTime: 24 * 60 * 60_000, // 24h — denom hashes are content-addressed
    refetchInterval: false,
  })
}

// ---------------------------------------------------------------------------
// Packet history (outbound + inbound IBC transfers)
// ---------------------------------------------------------------------------

export type IbcPacketDirection = 'outbound' | 'inbound'

/** Cross-chain packet status — what the user's IBC transfer is doing right now. */
export type IbcPacketStatus =
  | 'in-transit' // outbound: send_packet committed, no ack/timeout yet
  | 'acknowledged' // outbound: counterparty received + acked back to us
  | 'timed-out' // outbound: timeout fired; funds refunded to sender
  | 'received' // inbound: packet processed on this chain, funds in user's balance
  | 'failed' // inbound: fungible_token_packet.success === 'false' (denom refused, etc.)

export interface IbcPacket {
  direction: IbcPacketDirection
  status: IbcPacketStatus
  /** Tx hash on THIS chain — for outbound it's the send tx; for inbound it's the recv tx. */
  txHash: string
  height: number
  /** Block timestamp for the row's tx. Optional — defaults to undefined if
   * block-time lookup fails (rare). Block times are immutable so the value
   * once resolved is final. */
  timestamp?: Date
  /** Outbound: source channel from this chain's perspective. Inbound: dest channel. */
  channelId: string
  /** Packet sequence number (unique per channel). */
  sequence: string
  /** Counterparty bech32 (recipient on outbound, sender on inbound). */
  counterparty: string
  /** Coin denom as it appears on this chain (raw — `nund` for FUND sends out;
   * `transfer/channel-N/...` for inbound packet data before minting). */
  denom: string
  /** Coin amount, raw chain-side integer string. */
  amount: string
}

interface RawEventAttr {
  key: string
  value: string
}
interface RawEvent {
  type: string
  attributes: readonly RawEventAttr[]
}

function eventAttr(events: readonly RawEvent[], type: string, key: string): string {
  for (const e of events) {
    if (e.type !== type) continue
    const found = e.attributes.find((a) => a.key === key)
    if (found) return found.value
  }
  return ''
}

interface PacketDataJson {
  amount?: string
  denom?: string
  sender?: string
  receiver?: string
}

function parsePacketData(raw: string): PacketDataJson {
  try {
    return JSON.parse(raw) as PacketDataJson
  } catch {
    return {}
  }
}

export interface IbcHistoryPage {
  packets: IbcPacket[]
  page: number
  hasMore: boolean
}

/**
 * Cursor-paginated IBC packet history for `address`. Outbound + inbound are
 * fetched in parallel per page; status (in-transit / acknowledged / timed-out
 * for outbound) is resolved on demand by the per-row `usePacketStatus` hook,
 * keeping the list query fast even for accounts with thousands of packets.
 * Block-times resolve via `useBlockTime` per row, similarly cached.
 *
 * Each "Load more" click fetches `TX_SEARCH_PAGE_SIZE` outbound + the same
 * inbound (so up to 50 packets per click).
 */
export function useIbcHistory(address: string | null) {
  const endpoint = useActiveEndpoint()
  return useInfiniteQuery<IbcHistoryPage>({
    queryKey: ['ibc', 'history', endpoint.id, address],
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      const page = pageParam as number
      if (!address) return { packets: [], page, hasMore: false }
      const [outbound, inbound] = await Promise.all([
        txSearchPage(endpoint.rpc, [{ key: 'ibc_transfer.sender', value: address }], page),
        txSearchPage(
          endpoint.rpc,
          [{ key: 'fungible_token_packet.receiver', value: address }],
          page,
        ),
      ])
      const outboundPackets = outbound.txs
        .map((tx) => parseOutboundPacketShallow(tx))
        .filter((p): p is IbcPacket => p !== null)
      const inboundPackets = inbound.txs
        .map((tx) => parseInboundPacket(tx, address))
        .filter((p): p is IbcPacket => p !== null)
      const packets = [...outboundPackets, ...inboundPackets].sort(
        (a, b) => b.height - a.height,
      )
      return {
        packets,
        page,
        hasMore: outbound.hasMore || inbound.hasMore,
      }
    },
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    enabled: !!address,
    refetchInterval: 30_000,
  })
}

/**
 * Parse an outbound MsgTransfer tx into a packet — no status lookup. Status
 * is resolved on-demand by `usePacketStatus` per row so the list query stays
 * fast for accounts with thousands of packets.
 */
function parseOutboundPacketShallow(tx: IndexedTx): IbcPacket | null {
  const events = tx.events as RawEvent[]
  const channelId = eventAttr(events, 'send_packet', 'packet_src_channel')
  const sequence = eventAttr(events, 'send_packet', 'packet_sequence')
  if (!channelId || !sequence) return null
  const packetData = parsePacketData(eventAttr(events, 'send_packet', 'packet_data'))
  const counterparty =
    packetData.receiver ?? eventAttr(events, 'ibc_transfer', 'receiver')
  return {
    direction: 'outbound',
    // `in-transit` is the optimistic default — `usePacketStatus` upgrades
    // to acknowledged / timed-out asynchronously when its query resolves.
    status: 'in-transit',
    txHash: tx.hash,
    height: tx.height,
    channelId,
    sequence,
    counterparty,
    denom: packetData.denom ?? '',
    amount: packetData.amount ?? '0',
  }
}

/**
 * Per-row outbound status lookup — searches for the matching
 * acknowledge_packet or timeout_packet for `(channelId, sequence)`. Returns
 * `null` while loading. Cache time is infinite for terminal statuses (`acknowledged`
 * / `timed-out` never flip) and bounded for `in-transit` so a freshly-acked
 * packet's status updates promptly on next render.
 *
 * No-op when `direction === 'inbound'` — inbound status is already known
 * from the recv tx's `fungible_token_packet.success` attribute.
 */
export function usePacketStatus(
  direction: IbcPacketDirection,
  channelId: string,
  sequence: string,
) {
  const endpoint = useActiveEndpoint()
  return useQuery<IbcPacketStatus | null>({
    queryKey: ['ibc', 'packet-status', endpoint.id, channelId, sequence],
    queryFn: async () => {
      // For outbound packets, look up ack OR timeout. Each query is a single
      // page; we only need to know "does any match exist".
      const [acks, timeouts] = await Promise.all([
        txSearchPage(
          endpoint.rpc,
          [
            { key: 'acknowledge_packet.packet_src_channel', value: channelId },
            { key: 'acknowledge_packet.packet_sequence', value: sequence },
          ],
          1,
        ),
        txSearchPage(
          endpoint.rpc,
          [
            { key: 'timeout_packet.packet_src_channel', value: channelId },
            { key: 'timeout_packet.packet_sequence', value: sequence },
          ],
          1,
        ),
      ])
      if (acks.totalCount > 0) return 'acknowledged'
      if (timeouts.totalCount > 0) return 'timed-out'
      return 'in-transit'
    },
    enabled: direction === 'outbound',
    // Once acknowledged / timed-out, status never changes — cache forever.
    // While in-transit, refetch every 30 s to catch fresh acks.
    refetchInterval: (q) => {
      const status = q.state.data
      if (status === 'acknowledged' || status === 'timed-out') return false
      return 30_000
    },
    staleTime: Infinity,
  })
}

/**
 * Per-row block-time lookup. Block times are immutable, so cache time is
 * infinite. React Query dedupes parallel requests for the same height, so
 * multiple packet rows in the same block resolve via one RPC round-trip.
 */
export function useBlockTime(height: number) {
  const endpoint = useActiveEndpoint()
  return useQuery({
    queryKey: ['block-time', endpoint.id, height],
    queryFn: async (): Promise<Date | null> => {
      const client = await StargateClient.connect(endpoint.rpc)
      try {
        const block = await client.getBlock(height)
        return new Date(block.header.time)
      } finally {
        client.disconnect()
      }
    },
    enabled: height > 0,
    staleTime: Infinity,
  })
}

function parseInboundPacket(tx: IndexedTx, address: string): IbcPacket | null {
  const events = tx.events as RawEvent[]
  // Find the fungible_token_packet whose receiver matches the user — a
  // single tx can carry multiple recv_packets (e.g. relayer batches) so
  // we pick the one targeting this address.
  const ftp = events.find(
    (e) =>
      e.type === 'fungible_token_packet' &&
      e.attributes.some((a) => a.key === 'receiver' && a.value === address),
  )
  if (!ftp) return null
  const channelId = eventAttr(events, 'recv_packet', 'packet_dst_channel')
  const sequence = eventAttr(events, 'recv_packet', 'packet_sequence')
  if (!channelId || !sequence) return null
  const sender = ftp.attributes.find((a) => a.key === 'sender')?.value ?? ''
  const denom = ftp.attributes.find((a) => a.key === 'denom')?.value ?? ''
  const amount = ftp.attributes.find((a) => a.key === 'amount')?.value ?? '0'
  const success =
    ftp.attributes.find((a) => a.key === 'success')?.value ?? 'true'
  return {
    direction: 'inbound',
    status: success === 'true' ? 'received' : 'failed',
    txHash: tx.hash,
    height: tx.height,
    channelId,
    sequence,
    counterparty: sender,
    denom,
    amount,
  }
}
