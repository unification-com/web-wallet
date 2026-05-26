import {
  createProtobufRpcClient,
  QueryClient,
  StargateClient,
  type IndexedTx,
} from '@cosmjs/stargate'
import { Comet38Client } from '@cosmjs/tendermint-rpc'
import { useQuery } from '@tanstack/react-query'
import { type StreamResult } from '@unification-com/fundjs-react/mainchain/stream/v1/query'
import { QueryClientImpl } from '@unification-com/fundjs-react/mainchain/stream/v1/query.rpc.Query'
import { type Stream } from '@unification-com/fundjs-react/mainchain/stream/v1/stream'

import { useActiveEndpoint } from './chain'
import { nundToFund } from './msgs/send'

// ---------------------------------------------------------------------------
// Module note — fundjs-react sub-path imports
// ---------------------------------------------------------------------------
// Stream is a Unification-specific module (no cosmjs-types analogue) so we
// import the generated client + types directly from fundjs-react sub-paths.
// Path A architecture confirmed by build probe (M6.0) — typecheck clean,
// production bundle uneffected because Rollup tree-shakes the single
// QueryClientImpl from the per-module entry point.
//
// QueryClientImpl's constructor takes a `TxRpc`-shaped object — identical to
// cosmjs's `ProtobufRpcClient`. Reusing the same `makeXxxClient` pattern as
// `gov.ts` keeps the query layer architecturally uniform across modules.
// ---------------------------------------------------------------------------

// Re-export proto types so consumers don't reach into fundjs-react sub-paths.
export { type Stream, type StreamResult }

// ---------------------------------------------------------------------------
// Query client setup
// ---------------------------------------------------------------------------

async function makeStreamClient(rpc: string): Promise<{
  query: QueryClientImpl
  disconnect: () => void
}> {
  const cometClient = await Comet38Client.connect(rpc)
  const queryClient = new QueryClient(cometClient)
  const protoRpc = createProtobufRpcClient(queryClient)
  const query = new QueryClientImpl(protoRpc)
  return {
    query,
    disconnect: () => cometClient.disconnect(),
  }
}

// ---------------------------------------------------------------------------
// Pure helpers — testable without React
// ---------------------------------------------------------------------------

/**
 * Time remaining (ms) before the current deposit drains to zero. Negative
 * when the deposit has already drained (chain stops outflow once
 * `depositZeroTime` is in the past). Returns `null` when the stream has no
 * data (defensive — should always be set on chain-side `StreamResult`).
 */
export function depositRemainingMs(stream: Stream | undefined): number | null {
  if (!stream) return null
  return stream.depositZeroTime.getTime() - Date.now()
}

/**
 * Amount claimable now (in base units of the stream's denom) — equal to
 * `min(flowRate × secondsSinceLastOutflow, remainingDeposit)`. Chain caps it
 * at the deposit, so a stream past its `depositZeroTime` claims everything
 * left and no more.
 */
export function claimableNow(stream: Stream | undefined): bigint {
  if (!stream) return 0n
  const lastOutflowMs = stream.lastOutflowTime.getTime()
  const nowMs = Date.now()
  const elapsedSec = BigInt(Math.max(0, Math.floor((nowMs - lastOutflowMs) / 1000)))
  const earned = elapsedSec * stream.flowRate
  let depositAmount: bigint
  try {
    depositAmount = BigInt(stream.deposit.amount || '0')
  } catch {
    depositAmount = 0n
  }
  return earned < depositAmount ? earned : depositAmount
}

/**
 * Resolve a stream's denom defensively. `StreamResult.denom` was added to the
 * query response shape in Stage 5b (multi-denom support); chains running an
 * older binary return it as the default empty string. We fall back to the
 * stream's own `deposit.denom`, which has been the canonical source of denom
 * since x/stream's first ship. Final fallback to `'nund'` for safety so we
 * never broadcast a Msg with an empty Coin denom — the chain's TopUp keeper
 * has a vestigial "belt-and-braces" check that triggers on empty (see
 * `x-stream/x/stream/keeper/stream.go:212`).
 */
export function streamDenom(s: StreamResult): string {
  // `||` not `??` — pre-5b chains return `denom: ""` (empty string, not
  // undefined) in the StreamResult, so the nullish coalescing variant would
  // keep the empty value and miss the fallback. Same applies to the
  // nested `deposit.denom` cascade.
  // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
  return s.denom || s.stream?.deposit.denom || 'nund'
}

/** Period picker for {@link formatFlowRate}. */
export interface FlowRateDisplay {
  /** Human-readable amount per chosen period, e.g. `"1.5"`. */
  amountFund: string
  /** Period label, e.g. `'sec' | 'min' | 'hour' | 'day' | 'month'`. */
  period: 'sec' | 'min' | 'hour' | 'day' | 'month'
}

/** Seconds in each {@link FlowRateDisplay} period. */
export const SECONDS_PER_PERIOD: Record<FlowRateDisplay['period'], bigint> = {
  sec: 1n,
  min: 60n,
  hour: 3_600n,
  day: 86_400n,
  // SDK x/stream uses 30 days for "month" in `CalculateFlowRate` — match that
  // convention here so what the user sees pre-broadcast equals what the chain
  // computes post-broadcast.
  month: 30n * 86_400n,
}

/**
 * Pick a human-friendly period for a `flowRate` (nund per second) and return
 * the FUND-denominated amount per that period. Tries successively coarser
 * periods until the per-period amount is ≥ 1 nund; falls back to per-second
 * for sub-1-nund flows so dust-rate streams still render a sensible label.
 */
export function formatFlowRate(flowRate: bigint): FlowRateDisplay {
  const periods: FlowRateDisplay['period'][] = ['sec', 'min', 'hour', 'day', 'month']
  for (const period of periods) {
    const amount = flowRate * SECONDS_PER_PERIOD[period]
    if (amount >= 1_000_000_000n) {
      return { amountFund: nundToFund(amount.toString()), period }
    }
  }
  // Sub-FUND-per-month flow rate — display as-is per second (will read as
  // "0 FUND/sec" but is the most honest baseline).
  return { amountFund: nundToFund(flowRate.toString()), period: 'sec' }
}

/**
 * Sort key for stream lists: claimable streams first (so receivers see what
 * they can act on at the top), then by descending deposit remaining (most
 * funded streams above near-empty ones).
 */
export function sortStreams(streams: readonly StreamResult[]): StreamResult[] {
  return [...streams].sort((a, b) => {
    const ac = claimableNow(a.stream)
    const bc = claimableNow(b.stream)
    if (ac !== bc) return ac > bc ? -1 : 1
    const ad = depositRemainingMs(a.stream) ?? 0
    const bd = depositRemainingMs(b.stream) ?? 0
    return bd - ad
  })
}

// ---------------------------------------------------------------------------
// React hooks
// ---------------------------------------------------------------------------

/**
 * Streams where `address` is the receiver — the inbound list. One row per
 * `(sender, denom)` pair (Stage 5b multi-denom: a single sender can fund
 * multiple denom-distinct streams to the same receiver).
 */
export function useIncomingStreams(address: string | null) {
  const endpoint = useActiveEndpoint()
  return useQuery({
    queryKey: ['stream', 'incoming', endpoint.id, address],
    queryFn: async (): Promise<StreamResult[]> => {
      if (!address) return []
      const { query, disconnect } = await makeStreamClient(endpoint.rpc)
      try {
        const res = await query.allStreamsForReceiver({ receiverAddr: address })
        return res.streams
      } finally {
        disconnect()
      }
    },
    enabled: !!address,
    // 12s polling matches the chain's average block time — claimable amounts
    // tick up roughly that fast at typical flow rates.
    refetchInterval: 12_000,
  })
}

/**
 * Streams where `address` is the sender — the outbound list. Used by the
 * sender to monitor + manage (topup / update flow rate / cancel).
 */
export function useOutgoingStreams(address: string | null) {
  const endpoint = useActiveEndpoint()
  return useQuery({
    queryKey: ['stream', 'outgoing', endpoint.id, address],
    queryFn: async (): Promise<StreamResult[]> => {
      if (!address) return []
      const { query, disconnect } = await makeStreamClient(endpoint.rpc)
      try {
        const res = await query.allStreamsForSender({ senderAddr: address })
        return res.streams
      } finally {
        disconnect()
      }
    },
    enabled: !!address,
    refetchInterval: 12_000,
  })
}

/**
 * Real-time flow data for a specific `(receiver, sender, denom)` triple.
 * `currentFlowRate` is zero when the deposit has drained — useful for
 * surfacing "draining" vs "drained" states in the UI.
 */
export function useCurrentFlow(
  receiver: string | null,
  sender: string | null,
  denom: string | null,
) {
  const endpoint = useActiveEndpoint()
  const enabled = !!receiver && !!sender && !!denom
  return useQuery({
    queryKey: ['stream', 'flow', endpoint.id, receiver, sender, denom],
    queryFn: async () => {
      if (!enabled) return null
      const { query, disconnect } = await makeStreamClient(endpoint.rpc)
      try {
        const res = await query.streamReceiverSenderCurrentFlow({
          receiverAddr: receiver,
          senderAddr: sender,
          denom,
        })
        return res
      } finally {
        disconnect()
      }
    },
    enabled,
    refetchInterval: 12_000,
  })
}

// ---------------------------------------------------------------------------
// Per-stream event timeline
// ---------------------------------------------------------------------------

/** A single stream-related event surfaced for the timeline view. */
export interface StreamEvent {
  hash: string
  height: number
  txIndex: number
  /** Unique key within a Tx for events of the same kind. */
  eventIndex: number
  /** Event-type discriminator drives row rendering. */
  kind: 'create' | 'topup' | 'claim' | 'update' | 'cancel'
  /** Coin denom — always nund on pre-vaxildan chains. */
  denom: string
  /** Primary numeric value (nund). Optional — Create + Update events carry
   * non-amount data in the `secondary` field instead. */
  amountNund?: string
  /** Localised label for the primary value, e.g. `"Received"`, `"Refunded"`. */
  amountLabel?: 'received' | 'deposited' | 'refunded'
  /** Free-form secondary text (used for flow-rate change descriptions). */
  secondary?: string
}

interface RawEventAttr {
  key: string
  value: string
}
interface RawEvent {
  type: string
  attributes: readonly RawEventAttr[]
}

function readAttr(event: RawEvent, key: string): string {
  return event.attributes.find((a) => a.key === key)?.value ?? ''
}

/**
 * Cosmos event attributes for amounts come as `"<number><denom>"` strings
 * (e.g. `"2723333061nund"`) — same wire shape as `sdk.Coin.String()`. Split
 * into numeric + denom. Falls back to `{ amount: '0', denom: 'nund' }` on
 * unparseable input.
 */
function splitCoinAttr(value: string): { amount: string; denom: string } {
  // eslint-disable-next-line @typescript-eslint/prefer-regexp-exec
  const match = value.match(/^(\d+)([a-z][a-z0-9/]*)$/)
  if (!match) return { amount: '0', denom: 'nund' }
  return { amount: match[1] ?? '0', denom: match[2] ?? 'nund' }
}

/** Tendermint event types emitted by the x/stream module, mapped to our `kind` discriminator. */
const EVENT_TYPE_TO_KIND: Record<string, StreamEvent['kind']> = {
  create_stream: 'create',
  stream_deposit: 'topup',
  claim_stream: 'claim',
  update_flow_rate: 'update',
  cancel_stream: 'cancel',
}

/**
 * Full audit log for a `(sender, receiver)` stream pair — surfaces every
 * chain event (create / topup / claim / update / cancel) so users can trace
 * the stream's lifecycle. Uses 5 parallel `tx_search` queries (one per event
 * type) since Tendermint's query language is AND-only — UNION must happen
 * client-side. Returns events sorted newest-first.
 *
 * RPC tx-index pruning caveat: public nodes typically prune older entries,
 * so very-old stream events may not surface. M13 Phase 2 explorer-deep-link
 * is the proper long-term fix.
 */
export function useStreamEvents(sender: string | null, receiver: string | null) {
  const endpoint = useActiveEndpoint()
  const enabled = !!sender && !!receiver
  return useQuery({
    queryKey: ['stream', 'events', endpoint.id, sender, receiver],
    queryFn: async (): Promise<StreamEvent[]> => {
      if (!enabled) return []
      const client = await StargateClient.connect(endpoint.rpc)
      try {
        const eventTypes = Object.keys(EVENT_TYPE_TO_KIND)
        const results = await Promise.all(
          eventTypes.map((type) =>
            client.searchTx([
              { key: `${type}.sender`, value: sender },
              { key: `${type}.receiver`, value: receiver },
            ]),
          ),
        )
        // Each query returns Txs that emitted that event type for this pair.
        // For each Tx, extract every matching event of the queried type — a
        // single Tx may emit multiple (e.g. update + co-emitted claim).
        // Dedupe by (hash, event-type, event-index-within-tx).
        const seen = new Set<string>()
        const out: StreamEvent[] = []
        eventTypes.forEach((eventType, i) => {
          const kind = EVENT_TYPE_TO_KIND[eventType]
          if (!kind) return
          for (const tx of results[i] ?? []) {
            const events = tx.events as RawEvent[]
            let eventIndex = 0
            for (const e of events) {
              if (e.type !== eventType) continue
              if (readAttr(e, 'sender') !== sender) continue
              if (readAttr(e, 'receiver') !== receiver) continue
              const key = `${tx.hash}:${eventType}:${String(eventIndex)}`
              if (seen.has(key)) {
                eventIndex++
                continue
              }
              seen.add(key)
              out.push(makeStreamEvent(tx, e, kind, eventIndex))
              eventIndex++
            }
          }
        })
        // Newest first; ties on height break on txIndex.
        out.sort((a, b) => {
          if (a.height !== b.height) return b.height - a.height
          if (a.txIndex !== b.txIndex) return b.txIndex - a.txIndex
          return b.eventIndex - a.eventIndex
        })
        return out
      } finally {
        client.disconnect()
      }
    },
    enabled,
    // Event-driven — long polling is fine.
    refetchInterval: 60_000,
  })
}

function makeStreamEvent(
  tx: IndexedTx,
  event: RawEvent,
  kind: StreamEvent['kind'],
  eventIndex: number,
): StreamEvent {
  const base: Omit<StreamEvent, 'amountNund' | 'amountLabel' | 'secondary'> = {
    hash: tx.hash,
    height: tx.height,
    txIndex: tx.txIndex,
    eventIndex,
    kind,
    denom: 'nund',
  }
  switch (kind) {
    case 'create': {
      const flowRate = readAttr(event, 'flow_rate')
      return {
        ...base,
        secondary: flowRate ? `flow ${flowRate} nund/sec` : '',
      }
    }
    case 'topup': {
      const deposited = splitCoinAttr(readAttr(event, 'amount_deposited'))
      return {
        ...base,
        amountNund: deposited.amount,
        amountLabel: 'deposited',
        denom: deposited.denom,
      }
    }
    case 'claim': {
      const received = splitCoinAttr(readAttr(event, 'amount_received'))
      return {
        ...base,
        amountNund: received.amount,
        amountLabel: 'received',
        denom: received.denom,
      }
    }
    case 'update': {
      const oldRate = readAttr(event, 'old_flow_rate')
      const newRate = readAttr(event, 'new_flow_rate')
      return {
        ...base,
        secondary: oldRate && newRate ? `${oldRate} → ${newRate} nund/sec` : '',
      }
    }
    case 'cancel': {
      const refund = splitCoinAttr(readAttr(event, 'refund_amount'))
      return {
        ...base,
        amountNund: refund.amount,
        amountLabel: 'refunded',
        denom: refund.denom,
      }
    }
  }
}

/**
 * Convenience query for the chain's stream-module parameters (validator
 * fee fraction, max flow-rate, etc.). Cached aggressively — params change
 * via governance only.
 */
export function useStreamParams() {
  const endpoint = useActiveEndpoint()
  return useQuery({
    queryKey: ['stream', 'params', endpoint.id],
    queryFn: async () => {
      const { query, disconnect } = await makeStreamClient(endpoint.rpc)
      try {
        const res = await query.params({})
        return res.params
      } finally {
        disconnect()
      }
    },
    staleTime: 5 * 60_000,
    refetchInterval: false,
  })
}
