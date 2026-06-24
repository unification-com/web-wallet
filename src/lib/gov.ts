import {
  createProtobufRpcClient,
  QueryClient,
} from '@cosmjs/stargate'
import { Comet38Client } from '@cosmjs/tendermint-rpc'
import { useQuery } from '@tanstack/react-query'
import {
  ProposalStatus,
  type Proposal,
  type TallyResult,
  type Vote,
} from 'cosmjs-types/cosmos/gov/v1/gov'
import { QueryClientImpl } from 'cosmjs-types/cosmos/gov/v1/query'
import { MsgExecLegacyContent } from 'cosmjs-types/cosmos/gov/v1/tx'

import { useActiveEndpoint } from './chain'

// ---------------------------------------------------------------------------
// Module note — cosmjs `GovExtension` is v1beta1-only
// ---------------------------------------------------------------------------
// `@cosmjs/stargate`'s built-in `setupGovExtension` returns the v1beta1
// types — which drop the v1 multi-`messages[]` proposal shape and rename
// fields. Mainchain runs gov v1 (vaxildan-forward); we want first-class v1
// proposals. Solution: hand-roll a small extension using the same primitives
// cosmjs uses internally (`createProtobufRpcClient` + `QueryClientImpl` from
// the v1 proto bindings).
//
// Side benefit: this mirrors the same architectural pattern as `staking.ts`
// (cosmjs primitives over fundjs-react sub-paths) so the wallet's query
// layer is consistent across modules. Revisit when fundjs-react publishes
// to npm with proper ESM+CJS dual-export (Stage 10) — a swap-in across all
// query libs becomes search-and-replace.
// ---------------------------------------------------------------------------

// Re-export proto types + enums so consumers don't reach into cosmjs-types
// directly. Keeps the cosmjs-types surface a private implementation detail.
export {
  ProposalStatus,
  type Proposal,
  type TallyResult,
  type Vote,
}

export {
  VoteOption,
  type WeightedVoteOption,
} from 'cosmjs-types/cosmos/gov/v1/gov'

// ---------------------------------------------------------------------------
// Query client setup
// ---------------------------------------------------------------------------

async function makeGovClient(rpc: string): Promise<{
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
 * Returns true if the proposal is currently voteable (active voting period).
 * Used to gate the Vote button + decide whether to show countdowns vs final
 * tally numbers.
 */
export function isVoteable(p: Pick<Proposal, 'status'>): boolean {
  return Number(p.status) === Number(ProposalStatus.PROPOSAL_STATUS_VOTING_PERIOD)
}

/**
 * Read the first two string fields out of a length-delimited protobuf
 * payload. Every legacy `govtypes.Content` implementation in the
 * cosmos-sdk universe — `TextProposal`, `ParameterChangeProposal`,
 * `SoftwareUpgradeProposal`, `CancelSoftwareUpgradeProposal`,
 * `CommunityPoolSpendProposal`, `ClientUpdateProposal`, etc. — puts
 * `title: string` at proto field 1 and `description: string` at proto
 * field 2 (the SDK's `Content` interface contract maps `GetTitle()` /
 * `GetDescription()` to those field tags via the proto generator).
 *
 * Doing a generic field-1/field-2 read lets us extract title +
 * description from ANY legacy proposal type without per-type imports —
 * including custom chain modules whose proposal types aren't in
 * `cosmjs-types`.
 *
 * Returns `{ title: '', description: '' }` on unparseable input.
 *
 * Wire format reference: tag byte for a length-delimited (wire type 2)
 * field number N is `(N << 3) | 2`, so field 1 → `0x0a`, field 2 → `0x12`.
 */
function readLegacyTitleAndDescription(bytes: Uint8Array): {
  title: string
  description: string
} {
  let title = ''
  let description = ''
  const decoder = new TextDecoder('utf-8')
  let pos = 0
  while (pos < bytes.length && (title === '' || description === '')) {
    const tag = bytes[pos]
    if (tag === undefined) break
    pos++
    const fieldNum = tag >> 3
    const wireType = tag & 0x07
    if (wireType !== 2) {
      // Bail on non-string fields — title + description are always the
      // first two length-delimited fields in legacy Content types, so if
      // we hit a different wire type before finding them, give up rather
      // than risk mis-parsing a message field.
      break
    }
    // Read length as a varint.
    let len = 0
    let shift = 0
    while (pos < bytes.length) {
      const b = bytes[pos]
      if (b === undefined) break
      pos++
      len |= (b & 0x7f) << shift
      if ((b & 0x80) === 0) break
      shift += 7
    }
    const data = bytes.slice(pos, pos + len)
    pos += len
    if (fieldNum === 1) title = decoder.decode(data)
    else if (fieldNum === 2) description = decoder.decode(data)
    // Other field numbers (3, 4, …) might be strings too (e.g.
    // ClientUpdateProposal.subjectClientId at field 3) — we don't need
    // them, so loop continues until both title + description set OR end.
  }
  return { title, description }
}

interface LegacyContentInfo {
  /** The wrapped content typeUrl, e.g. `/cosmos.gov.v1beta1.TextProposal`. */
  typeUrl: string
  title: string
  description: string
}

/**
 * Unwrap a `MsgExecLegacyContent` from a v1 proposal's `messages[0]`.
 * Returns the wrapped content's typeUrl + a best-effort title +
 * description via the generic field-1/field-2 reader above. Older
 * proposals (submitted via the v1beta1 route, then migrated to v1
 * storage) consistently land here.
 */
function legacyContentInfo(proposal: Pick<Proposal, 'messages'>): LegacyContentInfo | null {
  const first = proposal.messages[0]
  if (!first) return null
  if (first.typeUrl !== '/cosmos.gov.v1.MsgExecLegacyContent') return null
  try {
    const exec = MsgExecLegacyContent.decode(first.value)
    const content = exec.content
    if (!content) return null
    const { title, description } = readLegacyTitleAndDescription(content.value)
    return { typeUrl: content.typeUrl, title, description }
  } catch {
    return null
  }
}

/**
 * Effective proposal title — prefers the v1 top-level `title`, falls back
 * to the wrapped legacy content's title when the proposal was submitted
 * via the v1beta1 route. Works for every `Content` implementation
 * (TextProposal, ParameterChangeProposal, SoftwareUpgradeProposal, etc.)
 * without needing per-type proto bindings.
 */
export function getProposalTitle(proposal: Pick<Proposal, 'title' | 'messages'>): string {
  if (proposal.title) return proposal.title
  return legacyContentInfo(proposal)?.title ?? ''
}

/**
 * Effective proposal summary — same fallback as `getProposalTitle`. The
 * v1beta1 `description` is the analogue of v1 `summary`.
 */
export function getProposalSummary(proposal: Pick<Proposal, 'summary' | 'messages'>): string {
  if (proposal.summary) return proposal.summary
  return legacyContentInfo(proposal)?.description ?? ''
}

/**
 * Effective proposal "type" label — for v1 proposals, the typeUrl of
 * `messages[0]`. For legacy v1beta1-via-MsgExecLegacyContent proposals
 * we surface the WRAPPED content's typeUrl (e.g.
 * `SoftwareUpgradeProposal`) instead of the wrapper
 * (`MsgExecLegacyContent`), which is the useful information for the user.
 * Returns an empty string when the proposal has no messages at all.
 */
export function getProposalMessageTypes(proposal: Pick<Proposal, 'messages'>): string[] {
  const legacy = legacyContentInfo(proposal)
  if (legacy) return [legacy.typeUrl]
  return Array.from(new Set(proposal.messages.map((m) => m.typeUrl)))
}

/**
 * Proposal ordering for the list view: active voting first (most actionable
 * for the user), then by descending id (newest first). Ties on status break
 * on id.
 */
export function sortProposals(proposals: readonly Proposal[]): Proposal[] {
  return [...proposals].sort((a, b) => {
    const av = isVoteable(a)
    const bv = isVoteable(b)
    if (av !== bv) return av ? -1 : 1
    // Compare bigint ids — descending.
    if (a.id === b.id) return 0
    return a.id > b.id ? -1 : 1
  })
}

/** Total tally count across all four options as a BigInt sum. */
export function tallyTotal(tally: TallyResult | undefined): bigint {
  if (!tally) return 0n
  try {
    return (
      BigInt(tally.yesCount || '0') +
      BigInt(tally.noCount || '0') +
      BigInt(tally.abstainCount || '0') +
      BigInt(tally.noWithVetoCount || '0')
    )
  } catch {
    return 0n
  }
}

/** Tally percentages (0..100) for each option. Returns 0 when total is 0. */
export interface TallyPercentages {
  yes: number
  no: number
  abstain: number
  noWithVeto: number
}

export function tallyPercentages(tally: TallyResult | undefined): TallyPercentages {
  const total = tallyTotal(tally)
  if (total === 0n || !tally) {
    return { yes: 0, no: 0, abstain: 0, noWithVeto: 0 }
  }
  // Multiply first then divide so we keep precision before the float divide;
  // tally counts can be huge (whole-FUND × 10^9 stake-weighted on mainchain).
  // ×10_000 / total → 4 significant figures, then /100 for percent.
  const pct = (count: string): number => {
    try {
      const big = BigInt(count || '0')
      const scaled = (big * 10_000n) / total
      return Number(scaled) / 100
    } catch {
      return 0
    }
  }
  return {
    yes: pct(tally.yesCount),
    no: pct(tally.noCount),
    abstain: pct(tally.abstainCount),
    noWithVeto: pct(tally.noWithVetoCount),
  }
}

// ---------------------------------------------------------------------------
// React hooks
// ---------------------------------------------------------------------------

/**
 * All proposals (optionally filtered by status). Server-side filter via the
 * `proposalStatus` request field — `PROPOSAL_STATUS_UNSPECIFIED` returns all.
 * Sorting + secondary-filter (e.g. by voter / depositor) happens client-side.
 */
export function useProposals(
  statusFilter: ProposalStatus = ProposalStatus.PROPOSAL_STATUS_UNSPECIFIED,
) {
  const endpoint = useActiveEndpoint()
  return useQuery({
    queryKey: ['gov', 'proposals', endpoint.id, statusFilter],
    queryFn: async () => {
      const { query, disconnect } = await makeGovClient(endpoint.rpc)
      try {
        const res = await query.Proposals({
          proposalStatus: statusFilter,
          voter: '',
          depositor: '',
        })
        return res.proposals
      } finally {
        disconnect()
      }
    },
    // Proposal set is slow-moving; status transitions are the only churn.
    // 30 s keeps tally numbers fresh enough without DDoSing the RPC.
    refetchInterval: 30_000,
  })
}

/** Single-proposal detail. */
export function useProposal(proposalId: bigint | undefined) {
  const endpoint = useActiveEndpoint()
  return useQuery({
    queryKey: ['gov', 'proposal', endpoint.id, proposalId?.toString()],
    queryFn: async () => {
      if (proposalId === undefined) return null
      const { query, disconnect } = await makeGovClient(endpoint.rpc)
      try {
        const res = await query.Proposal({ proposalId })
        return res.proposal
      } finally {
        disconnect()
      }
    },
    enabled: proposalId !== undefined,
    refetchInterval: 30_000,
  })
}

/**
 * Live tally for a proposal. The on-chain `Proposal.finalTallyResult` is
 * only populated post-voting-period; for active proposals the dedicated
 * TallyResult query returns the running tally.
 */
export function useTallyResult(proposalId: bigint | undefined) {
  const endpoint = useActiveEndpoint()
  return useQuery({
    queryKey: ['gov', 'tally', endpoint.id, proposalId?.toString()],
    queryFn: async () => {
      if (proposalId === undefined) return null
      const { query, disconnect } = await makeGovClient(endpoint.rpc)
      try {
        const res = await query.TallyResult({ proposalId })
        return res.tally
      } finally {
        disconnect()
      }
    },
    enabled: proposalId !== undefined,
    refetchInterval: 15_000,
  })
}

/**
 * The user's vote on a given proposal (or null if not voted). Throws on
 * "vote not found" — we normalise that to a null result so consumers can
 * render "no vote yet" without try/catch.
 */
export function useUserVote(proposalId: bigint | undefined, voter: string | null) {
  const endpoint = useActiveEndpoint()
  return useQuery({
    queryKey: ['gov', 'vote', endpoint.id, proposalId?.toString(), voter],
    queryFn: async () => {
      if (proposalId === undefined || !voter) return null
      const { query, disconnect } = await makeGovClient(endpoint.rpc)
      try {
        const res = await query.Vote({ proposalId, voter })
        return res.vote ?? null
      } catch {
        // "vote not found" is the expected pre-vote state — surface as null.
        return null
      } finally {
        disconnect()
      }
    },
    enabled: proposalId !== undefined && !!voter,
    refetchInterval: 15_000,
  })
}
