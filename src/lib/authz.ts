import {
  createProtobufRpcClient,
  QueryClient,
} from '@cosmjs/stargate'
import { Comet38Client } from '@cosmjs/tendermint-rpc'
import { useQuery } from '@tanstack/react-query'
import {
  GenericAuthorization,
  type GrantAuthorization,
} from 'cosmjs-types/cosmos/authz/v1beta1/authz'
import { QueryClientImpl } from 'cosmjs-types/cosmos/authz/v1beta1/query'
import { SendAuthorization } from 'cosmjs-types/cosmos/bank/v1beta1/authz'
import { type Coin } from 'cosmjs-types/cosmos/base/v1beta1/coin'
import {
  AuthorizationType,
  StakeAuthorization,
} from 'cosmjs-types/cosmos/staking/v1beta1/authz'

import { useActiveEndpoint } from './chain'

// ---------------------------------------------------------------------------
// Module note — cosmjs has no `setupAuthzExtension`, hand-roll one
// ---------------------------------------------------------------------------
// `@cosmjs/stargate` ships no built-in authz extension as of v0.38, so we
// follow the same pattern as `gov.ts` and `staking.ts`: connect a raw
// Comet38 RPC, wrap it in cosmjs's `QueryClient` + `createProtobufRpcClient`,
// then instantiate the proto-generated `QueryClientImpl`. Same migration
// trigger as the other custom query libs: revisit when fundjs-react
// publishes to npm with proper ESM+CJS dual-export (Stage 10).
// ---------------------------------------------------------------------------

// Re-export proto types + enums so consumers don't reach into cosmjs-types
// directly. Keeps the cosmjs-types surface a private implementation detail.
export {
  AuthorizationType,
  GenericAuthorization,
  SendAuthorization,
  StakeAuthorization,
  type GrantAuthorization,
}

// ---------------------------------------------------------------------------
// Known authorization typeUrls — used for routing the per-row detail
// renderer (StakeAuthz vs SendAuthz vs Generic vs unknown).
// ---------------------------------------------------------------------------

export const STAKE_AUTHORIZATION_URL = '/cosmos.staking.v1beta1.StakeAuthorization'
export const SEND_AUTHORIZATION_URL = '/cosmos.bank.v1beta1.SendAuthorization'
export const GENERIC_AUTHORIZATION_URL = '/cosmos.authz.v1beta1.GenericAuthorization'

// ---------------------------------------------------------------------------
// Query client setup
// ---------------------------------------------------------------------------

async function makeAuthzClient(rpc: string): Promise<{
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
// Decoded-authorization view models
// ---------------------------------------------------------------------------

/**
 * The discriminated union we surface to UI consumers. The on-chain shape
 * is `{ authorization: Any, expiration?: Timestamp }`, where `Any.value`
 * is one of three protobuf-encoded payloads. Decoding once in the query
 * layer keeps every consumer purely declarative.
 *
 * Falls back to `{ kind: 'unknown', typeUrl }` for any authorization type
 * we don't recognise (rare on Unification today — gov stake + Restake
 * grants dominate — but defensive). The unknown variant lets the UI list
 * the grant as "revoke this opaque grant" without exploding.
 */
export type DecodedAuthorization =
  | {
      kind: 'stake'
      /** Delegate / undelegate / redelegate (or unspecified = any). */
      authzType: AuthorizationType
      /** Optional cap on the total amount that may be staked under this grant. */
      maxTokens: Coin | undefined
      /** Allow-list of validator operator addresses (mutually exclusive with denyList). */
      allowList: readonly string[] | null
      /** Deny-list of validator operator addresses. */
      denyList: readonly string[] | null
    }
  | {
      kind: 'send'
      /** Spend cap on bank-send operations under this grant. */
      spendLimit: readonly Coin[]
      /** Recipients the grantee is allowed to send to (empty = any). */
      allowList: readonly string[]
    }
  | {
      kind: 'generic'
      /** Inner Msg typeUrl the grantee may execute on behalf of the granter. */
      msgTypeUrl: string
    }
  | {
      kind: 'unknown'
      typeUrl: string
    }

/** Decode an on-chain `Any`-wrapped authorization into our view-model union. */
export function decodeAuthorization(
  authorization: { typeUrl: string; value: Uint8Array } | undefined,
): DecodedAuthorization {
  if (!authorization) return { kind: 'unknown', typeUrl: '' }
  try {
    if (authorization.typeUrl === STAKE_AUTHORIZATION_URL) {
      const stake = StakeAuthorization.decode(authorization.value)
      return {
        kind: 'stake',
        authzType: stake.authorizationType,
        maxTokens: stake.maxTokens,
        allowList: stake.allowList?.address ?? null,
        denyList: stake.denyList?.address ?? null,
      }
    }
    if (authorization.typeUrl === SEND_AUTHORIZATION_URL) {
      const send = SendAuthorization.decode(authorization.value)
      return {
        kind: 'send',
        spendLimit: send.spendLimit,
        allowList: send.allowList,
      }
    }
    if (authorization.typeUrl === GENERIC_AUTHORIZATION_URL) {
      const generic = GenericAuthorization.decode(authorization.value)
      return { kind: 'generic', msgTypeUrl: generic.msg }
    }
  } catch {
    // Fall through to unknown — corrupted on-chain shape (shouldn't happen,
    // but we don't want to crash the panel).
  }
  return { kind: 'unknown', typeUrl: authorization.typeUrl }
}

/** Convenience view model produced by the query layer for each grant row. */
export interface AuthzGrantRow {
  granter: string
  grantee: string
  /** Original `Any`-wrapped authorization — kept around so revoke flows have the
   * exact typeUrl to send back without re-encoding. */
  authorization: { typeUrl: string; value: Uint8Array } | undefined
  /** Decoded view model for the renderer. */
  decoded: DecodedAuthorization
  /** Unix milliseconds; null means "no expiration" (the grant never auto-expires). */
  expiresAtMs: number | null
}

function asRow(g: GrantAuthorization): AuthzGrantRow {
  const expiresAtMs = g.expiration
    ? Number(g.expiration.seconds) * 1000 + Math.floor(g.expiration.nanos / 1_000_000)
    : null
  return {
    granter: g.granter,
    grantee: g.grantee,
    authorization: g.authorization,
    decoded: decodeAuthorization(g.authorization),
    expiresAtMs,
  }
}

// ---------------------------------------------------------------------------
// Hooks — granter side + grantee side
// ---------------------------------------------------------------------------

/**
 * Grants the user has given out (granter = active address). This is the
 * common case — every Restake-style auto-compounder bot the user has
 * authorised lands here. Used by `<AuthzPanel />` to drive the "Grants I've
 * given" list.
 */
export function useGranterGrants(granter: string | null) {
  const endpoint = useActiveEndpoint()
  return useQuery({
    queryKey: ['authz', 'granter', endpoint.id, granter],
    queryFn: async (): Promise<readonly AuthzGrantRow[]> => {
      if (!granter) return []
      const { query, disconnect } = await makeAuthzClient(endpoint.rpc)
      try {
        const res = await query.GranterGrants({ granter })
        return res.grants.map(asRow)
      } finally {
        disconnect()
      }
    },
    enabled: !!granter,
    // Grants change rarely (the user grants once a year, revokes once a year);
    // 30 s is enough to catch their own write through invalidation without
    // hammering the RPC.
    refetchInterval: 30_000,
  })
}

/**
 * Grants the user has received (grantee = active address). Rare in practice
 * — most Unification users only ever act as granter — but ship for
 * completeness. The Restake-style bots themselves are the grantees of
 * thousands of grants, but their addresses aren't user-facing.
 */
export function useGranteeGrants(grantee: string | null) {
  const endpoint = useActiveEndpoint()
  return useQuery({
    queryKey: ['authz', 'grantee', endpoint.id, grantee],
    queryFn: async (): Promise<readonly AuthzGrantRow[]> => {
      if (!grantee) return []
      const { query, disconnect } = await makeAuthzClient(endpoint.rpc)
      try {
        const res = await query.GranteeGrants({ grantee })
        return res.grants.map(asRow)
      } finally {
        disconnect()
      }
    },
    enabled: !!grantee,
    refetchInterval: 30_000,
  })
}
