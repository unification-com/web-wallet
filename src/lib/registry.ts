import { type GeneratedType, Registry } from '@cosmjs/proto-signing'
import { defaultRegistryTypes } from '@cosmjs/stargate'
import {
  MsgCancelStream,
  MsgClaimStream,
  MsgCreateStream,
  MsgTopUpDeposit,
  MsgUpdateFlowRate,
} from '@unification-com/fundjs-react/mainchain/stream/v1/tx'

// ---------------------------------------------------------------------------
// Unification chain Msg registry
// ---------------------------------------------------------------------------
// cosmjs's `SigningStargateClient` ships a default registry covering the
// standard cosmos-sdk Msgs (bank, staking, gov, distribution, etc.). It does
// NOT know about Unification's custom modules (stream, beacon, wrkchain,
// enterprise) — broadcasting any of those Msgs without a custom registry
// fails with `Unregistered type url`.
//
// We compose one shared registry covering both. Telescope's
// `TelescopeGeneratedType` aliases to cosmjs's `GeneratedType` shape
// (`encode` / `decode` / `fromPartial`) so they're structurally
// interchangeable — no cast needed.
//
// Subsequent milestones append their typeUrls here:
//   - M7 enterprise: enterprise/v1 MsgUndPurchaseOrder etc.
//   - M8 IBC transfer: ibc/applications/transfer/v1 (already covered by
//     cosmjs default registry, but custom denom traces may want overrides)
//
// We assemble the registry array locally rather than re-export from
// fundjs-react's pre-built `tx.registry`. Rollup's CJS interop can't see
// `exports.registry = [...]` as a named export from the linked dist, while
// the individual `class` Msg exports work fine.
// ---------------------------------------------------------------------------

const unificationRegistryTypes: readonly [string, GeneratedType][] = [
  ['/mainchain.stream.v1.MsgCreateStream', MsgCreateStream],
  ['/mainchain.stream.v1.MsgClaimStream', MsgClaimStream],
  ['/mainchain.stream.v1.MsgTopUpDeposit', MsgTopUpDeposit],
  ['/mainchain.stream.v1.MsgUpdateFlowRate', MsgUpdateFlowRate],
  ['/mainchain.stream.v1.MsgCancelStream', MsgCancelStream],
]

/**
 * The chain-aware registry used by every Tx-submitting flow in the wallet.
 * Single source of truth — extended in-place as new modules need to broadcast
 * Msgs the cosmjs default registry doesn't cover.
 */
export const unificationRegistry: Registry = new Registry([
  ...defaultRegistryTypes,
  ...unificationRegistryTypes,
])
