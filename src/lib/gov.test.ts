import { describe, expect, it } from 'vitest'

import {
  isVoteable,
  ProposalStatus,
  sortProposals,
  tallyPercentages,
  tallyTotal,
  type Proposal,
  type TallyResult,
} from './gov'

// Build a minimal Proposal stub. Tests only touch `id` + `status`; optional
// proto Timestamp fields are intentionally omitted (exactOptionalPropertyTypes
// forbids explicit `undefined`). Cast through Proposal is safe here — the
// pure helpers under test only read `id` + `status`.
function mkProposal(id: bigint, status: ProposalStatus): Proposal {
  return {
    id,
    messages: [],
    status,
    totalDeposit: [],
    metadata: '',
    title: '',
    summary: '',
    proposer: '',
    expedited: false,
    failedReason: '',
  }
}

function mkTally(yes: string, no: string, abstain: string, veto: string): TallyResult {
  return {
    yesCount: yes,
    noCount: no,
    abstainCount: abstain,
    noWithVetoCount: veto,
  }
}

describe('gov.isVoteable', () => {
  it('returns true only for PROPOSAL_STATUS_VOTING_PERIOD', () => {
    expect(isVoteable({ status: ProposalStatus.PROPOSAL_STATUS_VOTING_PERIOD })).toBe(true)
    expect(isVoteable({ status: ProposalStatus.PROPOSAL_STATUS_PASSED })).toBe(false)
    expect(isVoteable({ status: ProposalStatus.PROPOSAL_STATUS_REJECTED })).toBe(false)
    expect(isVoteable({ status: ProposalStatus.PROPOSAL_STATUS_DEPOSIT_PERIOD })).toBe(false)
    expect(isVoteable({ status: ProposalStatus.PROPOSAL_STATUS_FAILED })).toBe(false)
    expect(isVoteable({ status: ProposalStatus.PROPOSAL_STATUS_UNSPECIFIED })).toBe(false)
  })
})

describe('gov.sortProposals', () => {
  it('puts VOTING_PERIOD entries ahead of all other statuses', () => {
    const list = [
      mkProposal(5n, ProposalStatus.PROPOSAL_STATUS_PASSED),
      mkProposal(7n, ProposalStatus.PROPOSAL_STATUS_VOTING_PERIOD),
      mkProposal(3n, ProposalStatus.PROPOSAL_STATUS_VOTING_PERIOD),
      mkProposal(9n, ProposalStatus.PROPOSAL_STATUS_REJECTED),
    ]
    const sorted = sortProposals(list)
    expect(sorted.map((p) => p.id)).toEqual([7n, 3n, 9n, 5n])
  })

  it('orders by id desc within the same status bucket', () => {
    const list = [
      mkProposal(1n, ProposalStatus.PROPOSAL_STATUS_PASSED),
      mkProposal(3n, ProposalStatus.PROPOSAL_STATUS_PASSED),
      mkProposal(2n, ProposalStatus.PROPOSAL_STATUS_PASSED),
    ]
    expect(sortProposals(list).map((p) => p.id)).toEqual([3n, 2n, 1n])
  })

  it('does not mutate the input list', () => {
    const original = [
      mkProposal(1n, ProposalStatus.PROPOSAL_STATUS_PASSED),
      mkProposal(2n, ProposalStatus.PROPOSAL_STATUS_VOTING_PERIOD),
    ]
    const snapshot = original.map((p) => p.id)
    sortProposals(original)
    expect(original.map((p) => p.id)).toEqual(snapshot)
  })
})

describe('gov.tallyTotal', () => {
  it('sums all four option counts as BigInt', () => {
    expect(tallyTotal(mkTally('100', '50', '25', '5'))).toBe(180n)
  })

  it('returns 0 for empty / undefined / unparseable tallies', () => {
    expect(tallyTotal(undefined)).toBe(0n)
    expect(tallyTotal(mkTally('', '', '', ''))).toBe(0n)
    expect(tallyTotal(mkTally('not-a-number', '0', '0', '0'))).toBe(0n)
  })

  it('handles whole-FUND-scaled stake-weighted counts without precision loss', () => {
    // A real mainnet proposal could see e.g. 100M FUND = 10^17 nund-power per option.
    const big = '100000000000000000'
    expect(tallyTotal(mkTally(big, big, big, big))).toBe(BigInt(big) * 4n)
  })
})

describe('gov.tallyPercentages', () => {
  it('returns zeros when total is zero', () => {
    expect(tallyPercentages(undefined)).toEqual({ yes: 0, no: 0, abstain: 0, noWithVeto: 0 })
    expect(tallyPercentages(mkTally('0', '0', '0', '0'))).toEqual({
      yes: 0,
      no: 0,
      abstain: 0,
      noWithVeto: 0,
    })
  })

  it('computes 50/50 splits at percent precision', () => {
    const r = tallyPercentages(mkTally('500', '500', '0', '0'))
    expect(r.yes).toBe(50)
    expect(r.no).toBe(50)
    expect(r.abstain).toBe(0)
    expect(r.noWithVeto).toBe(0)
  })

  it('rounds to 2 decimal places', () => {
    // 1 yes, 2 no, 0 abstain, 0 veto → 33.33% / 66.66% / 0 / 0
    const r = tallyPercentages(mkTally('1', '2', '0', '0'))
    expect(r.yes).toBeCloseTo(33.33, 1)
    expect(r.no).toBeCloseTo(66.66, 1)
  })

  it('totals to ~100% (some rounding loss is acceptable)', () => {
    const r = tallyPercentages(mkTally('1', '1', '1', '1'))
    const total = r.yes + r.no + r.abstain + r.noWithVeto
    expect(total).toBeGreaterThan(99.5)
    expect(total).toBeLessThanOrEqual(100)
  })
})
