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
