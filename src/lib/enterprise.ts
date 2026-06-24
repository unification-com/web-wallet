import {
  createProtobufRpcClient,
  QueryClient,
} from '@cosmjs/stargate'
import { Comet38Client } from '@cosmjs/tendermint-rpc'
import { useQuery } from '@tanstack/react-query'
import {
  type EnterpriseUndPurchaseOrder,
  type EnterpriseUserAccount,
  type PurchaseOrderDecision,
  PurchaseOrderStatus,
} from '@unification-com/fundjs-react/mainchain/enterprise/v1/enterprise'
import { QueryClientImpl } from '@unification-com/fundjs-react/mainchain/enterprise/v1/query.rpc.Query'

import { useActiveEndpoint } from './chain'

// ---------------------------------------------------------------------------
// Module note — fundjs-react sub-path imports
// ---------------------------------------------------------------------------
// Enterprise is a Unification-specific module (no cosmjs-types analogue) so
// we use the same Path A architecture proven in M6 streams: import generated
// client + types from fundjs-react sub-paths, wired through cosmjs's
// `QueryClient` + `createProtobufRpcClient`. Mirrors `src/lib/gov.ts` and
// `src/lib/stream.ts` patterns.
// ---------------------------------------------------------------------------

// Re-export proto types so consumers don't reach into fundjs-react sub-paths.
export {
  type EnterpriseUndPurchaseOrder,
  type EnterpriseUserAccount,
  type PurchaseOrderDecision,
  PurchaseOrderStatus,
}

async function makeEnterpriseClient(rpc: string): Promise<{
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
// React hooks
// ---------------------------------------------------------------------------

/**
 * Is `address` on the enterprise whitelist? Used to gate the Raise-PO form;
 * non-whitelisted users see an explainer block instead. Cached aggressively
 * — whitelist changes are governance-rare.
 */
export function useIsWhitelisted(address: string | null) {
  const endpoint = useActiveEndpoint()
  return useQuery({
    queryKey: ['enterprise', 'whitelisted', endpoint.id, address],
    queryFn: async () => {
      if (!address) return false
      const { query, disconnect } = await makeEnterpriseClient(endpoint.rpc)
      try {
        const res = await query.whitelisted({ address })
        return res.whitelisted
      } finally {
        disconnect()
      }
    },
    enabled: !!address,
    // 5 min — whitelist changes are governance + admin-tool driven.
    staleTime: 5 * 60_000,
    refetchInterval: false,
  })
}

/**
 * Locked-eFUND balance for `address` — the amount the chain has minted into
 * the user's enterprise account but is reserved for paying chain fees only
 * (can't be transferred). Returns `{ denom, amount }` (nund-scaled).
 */
export function useLockedFund(address: string | null) {
  const endpoint = useActiveEndpoint()
  return useQuery({
    queryKey: ['enterprise', 'locked', endpoint.id, address],
    queryFn: async () => {
      if (!address) return null
      const { query, disconnect } = await makeEnterpriseClient(endpoint.rpc)
      try {
        const res = await query.lockedUndByAddress({ owner: address })
        return res.amount
      } finally {
        disconnect()
      }
    },
    enabled: !!address,
    refetchInterval: 12_000,
  })
}

/**
 * Combined enterprise account view for `address`: locked eFUND + general
 * supply (regular bank-module FUND) + spent eFUND tally + spendable total.
 * Replaces calling `useLockedFund` + `useSpentEFUND` separately — the chain
 * returns all four in one round-trip via the dedicated `EnterpriseAccount`
 * query.
 */
export function useEnterpriseAccount(address: string | null) {
  const endpoint = useActiveEndpoint()
  return useQuery({
    queryKey: ['enterprise', 'account', endpoint.id, address],
    queryFn: async (): Promise<EnterpriseUserAccount | null> => {
      if (!address) return null
      const { query, disconnect } = await makeEnterpriseClient(endpoint.rpc)
      try {
        const res = await query.enterpriseAccount({ address })
        return res.account
      } finally {
        disconnect()
      }
    },
    enabled: !!address,
    // Spent eFUND ticks up every time the user pays a beacon / wrkchain fee
    // — 12 s polling keeps the tally fresh without hammering the RPC.
    refetchInterval: 12_000,
  })
}

/**
 * Purchase orders raised by `address`. `statusFilter = STATUS_NIL` returns
 * every status (the chain treats `_NIL` as "any") which is what the wallet
 * wants for the user's own history view.
 */
export function usePurchaseOrders(
  address: string | null,
  statusFilter: PurchaseOrderStatus = PurchaseOrderStatus.STATUS_NIL,
) {
  const endpoint = useActiveEndpoint()
  return useQuery({
    queryKey: ['enterprise', 'orders', endpoint.id, address, statusFilter],
    queryFn: async (): Promise<EnterpriseUndPurchaseOrder[]> => {
      if (!address) return []
      const { query, disconnect } = await makeEnterpriseClient(endpoint.rpc)
      try {
        const res = await query.enterpriseUndPurchaseOrders({
          purchaser: address,
          status: statusFilter,
        })
        return res.purchaseOrders
      } finally {
        disconnect()
      }
    },
    enabled: !!address,
    // POs are operator-processed asynchronously — refresh every 30 s so a
    // newly-raised order quickly shows status transitions.
    refetchInterval: 30_000,
  })
}

/**
 * Single-PO detail by ID — useful for deep-link / detail-view paths and for
 * polling a specific PO's status without re-fetching the full history. Picks
 * up the same 30 s refresh cadence as the list query so status transitions
 * surface promptly.
 */
export function usePurchaseOrder(id: bigint | null) {
  const endpoint = useActiveEndpoint()
  return useQuery({
    queryKey: ['enterprise', 'order', endpoint.id, id?.toString()],
    queryFn: async (): Promise<EnterpriseUndPurchaseOrder | null> => {
      if (id === null) return null
      const { query, disconnect } = await makeEnterpriseClient(endpoint.rpc)
      try {
        const res = await query.enterpriseUndPurchaseOrder({
          purchaseOrderId: id,
        })
        return res.purchaseOrder
      } finally {
        disconnect()
      }
    },
    enabled: id !== null,
    refetchInterval: 30_000,
  })
}

/**
 * Module parameters (e.g. min/max raise amount, allowed denoms). Cached
 * aggressively — params change via governance only.
 */
export function useEnterpriseParams() {
  const endpoint = useActiveEndpoint()
  return useQuery({
    queryKey: ['enterprise', 'params', endpoint.id],
    queryFn: async () => {
      const { query, disconnect } = await makeEnterpriseClient(endpoint.rpc)
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

// ---------------------------------------------------------------------------
// Pure helpers — testable without React
// ---------------------------------------------------------------------------

/**
 * Localised label key for a `PurchaseOrderStatus` enum value. Returns a
 * stable identifier; UI maps to translated text. `STATUS_NIL` is normalised
 * to `unknown` since it shouldn't appear on a real PO row.
 */
export function statusLabel(status: PurchaseOrderStatus): string {
  switch (status) {
    case PurchaseOrderStatus.STATUS_RAISED:
      return 'raised'
    case PurchaseOrderStatus.STATUS_ACCEPTED:
      return 'accepted'
    case PurchaseOrderStatus.STATUS_REJECTED:
      return 'rejected'
    case PurchaseOrderStatus.STATUS_COMPLETED:
      return 'completed'
    case PurchaseOrderStatus.STATUS_NIL:
    case PurchaseOrderStatus.UNRECOGNIZED:
    default:
      return 'unknown'
  }
}

/**
 * Sort POs newest-first by `raiseTime` (Unix seconds). Stable for ties on
 * `id` descending.
 */
export function sortPurchaseOrders(
  orders: readonly EnterpriseUndPurchaseOrder[],
): EnterpriseUndPurchaseOrder[] {
  return [...orders].sort((a, b) => {
    if (a.raiseTime !== b.raiseTime) return Number(b.raiseTime - a.raiseTime)
    if (a.id === b.id) return 0
    return a.id > b.id ? -1 : 1
  })
}
