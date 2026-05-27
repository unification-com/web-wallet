import { QueryClient, setupIbcExtension } from '@cosmjs/stargate'
import { Comet38Client } from '@cosmjs/tendermint-rpc'
import { useQuery } from '@tanstack/react-query'
import { State as ChannelState } from 'cosmjs-types/ibc/core/channel/v1/channel'

import { useActiveEndpoint } from './chain'

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
        // Resolve counterparty chain IDs in parallel — the client-state
        // query is per-channel.
        const resolved = await Promise.all(
          open.map(async (c) => {
            try {
              const res = await ibc.ibc.channel.clientState(c.portId, c.channelId)
              // The client state is a generic `Any`; cosmjs has a
              // `stateTm` helper that decodes Tendermint light clients
              // specifically. Use the generic shape here since we only
              // need `chainId` and that field lives at a stable offset
              // in the Tendermint variant.
              const cs = res.identifiedClientState?.clientState
              if (!cs) return null
              // The Any payload's `value` bytes need decoding. cosmjs
              // exposes `ibc.client.stateTm` which auto-decodes; we use
              // it via a second call since `clientState` returns the
              // wrapped form.
              const tm = await ibc.ibc.client.stateTm(
                res.identifiedClientState?.clientId ?? '',
              )
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
    // Channels are governance / relayer-managed — changes are rare.
    staleTime: 60 * 60_000, // 60 min
    refetchInterval: false,
  })
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
