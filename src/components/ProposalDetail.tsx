import { Trans, useLingui } from '@lingui/react/macro'
import { useState } from 'react'

import { ProposalStatusBadge } from '@/components/ProposalStatusBadge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { VoteModal } from '@/components/VoteModal'
import {
  ProposalStatus,
  VoteOption,
  getProposalMessageTypes,
  getProposalSummary,
  getProposalTitle,
  isVoteable,
  tallyPercentages,
  tallyTotal,
  useProposal,
  useTallyResult,
  useUserVote,
} from '@/lib/gov'
import { nundToFund } from '@/lib/msgs/send'
import { useActiveSigner } from '@/lib/signer'
import { formatRelativeDeadline, timestampToDate, useTickingNow } from '@/lib/time'

interface ProposalDetailProps {
  proposalId: bigint
  onBack: () => void
}

/**
 * Single-proposal detail view: title + summary + message types + voting
 * timeline + deposit + live tally bars + "your vote" indicator + Vote
 * button (active-status only). Back button returns to the list.
 *
 * Tally numbers are stake-weighted nund counts; display them as integer
 * FUND via `nundToFund` (Coin.amount form — staking power is integer nund,
 * not LegacyDec like distribution rewards).
 */
export function ProposalDetail({ proposalId, onBack }: ProposalDetailProps) {
  const { address } = useActiveSigner()
  const { t } = useLingui()
  const now = useTickingNow(60_000)

  const { data: proposal, isLoading, isError } = useProposal(proposalId)
  const { data: tally } = useTallyResult(proposalId)
  const { data: userVote } = useUserVote(proposalId, address)

  const [voteOpen, setVoteOpen] = useState(false)

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        <BackButton onClick={onBack} />
        <p className="text-muted-foreground text-sm">
          <Trans>Loading proposal…</Trans>
        </p>
      </div>
    )
  }
  if (isError || !proposal) {
    return (
      <div className="flex flex-col gap-3">
        <BackButton onClick={onBack} />
        <p className="text-destructive text-sm">
          <Trans>Couldn&apos;t load proposal #{proposalId.toString()}.</Trans>
        </p>
      </div>
    )
  }

  // For finalised proposals the live tally query returns the same numbers
  // baked into `proposal.finalTallyResult`. Live tally takes precedence
  // because it has the freshest reads during the voting window.
  const effectiveTally = tally ?? proposal.finalTallyResult
  const pct = tallyPercentages(effectiveTally)
  const total = tallyTotal(effectiveTally)

  const votingEnd = timestampToDate(proposal.votingEndTime)
  const votingEndRel = formatRelativeDeadline(votingEnd, now)
  const submitTime = timestampToDate(proposal.submitTime)
  const depositEnd = timestampToDate(proposal.depositEndTime)

  // Message-type summary — for v1 multi-message proposals show all distinct
  // typeUrls. For legacy v1beta1 proposals submitted via
  // MsgExecLegacyContent, `getProposalMessageTypes` unwraps the inner
  // content typeUrl (e.g. `SoftwareUpgradeProposal`) instead of just
  // surfacing the wrapper (`MsgExecLegacyContent`), which is the useful
  // information for the user.
  const messageTypes = getProposalMessageTypes(proposal).map(shortTypeUrl)

  return (
    <>
      <div className="flex flex-col gap-3">
        <BackButton onClick={onBack} />

        <Card>
          <CardHeader className="p-4 pb-2 flex flex-row items-start justify-between space-y-0 gap-2">
            <div className="flex flex-col min-w-0">
              <CardTitle className="text-sm leading-snug">
                <Trans>#{proposal.id.toString()} — {getProposalTitle(proposal) || '(untitled)'}</Trans>
              </CardTitle>
              {proposal.expedited && (
                <span className="text-[10px] uppercase tracking-wider text-amber-700 mt-0.5">
                  <Trans>Expedited</Trans>
                </span>
              )}
            </div>
            <ProposalStatusBadge status={proposal.status} size="md" />
          </CardHeader>
          <CardContent className="p-4 pt-2 flex flex-col gap-3 text-xs">
            {(() => {
              const summary = getProposalSummary(proposal)
              return summary ? (
                <p className="whitespace-pre-wrap text-muted-foreground">{summary}</p>
              ) : null
            })()}

            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[11px]">
              {messageTypes.length > 0 && (
                <>
                  <dt className="text-muted-foreground">
                    <Trans>Type</Trans>
                  </dt>
                  <dd className="font-mono break-all">{messageTypes.join(', ')}</dd>
                </>
              )}
              {submitTime && (
                <>
                  <dt className="text-muted-foreground">
                    <Trans>Submitted</Trans>
                  </dt>
                  <dd>{submitTime.toLocaleString()}</dd>
                </>
              )}
              {depositEnd && proposal.status === ProposalStatus.PROPOSAL_STATUS_DEPOSIT_PERIOD && (
                <>
                  <dt className="text-muted-foreground">
                    <Trans>Deposit ends</Trans>
                  </dt>
                  <dd title={depositEnd.toISOString()}>
                    {formatRelativeDeadline(depositEnd, now).label}
                  </dd>
                </>
              )}
              {votingEnd && (
                <>
                  <dt className="text-muted-foreground">
                    <Trans>Voting ends</Trans>
                  </dt>
                  <dd title={votingEnd.toISOString()}>
                    {votingEndRel.complete ? <Trans>Closed</Trans> : votingEndRel.label}
                  </dd>
                </>
              )}
              {proposal.totalDeposit.length > 0 && (
                <>
                  <dt className="text-muted-foreground">
                    <Trans>Deposit</Trans>
                  </dt>
                  <dd className="font-mono">
                    {proposal.totalDeposit
                      .map((c) =>
                        c.denom === 'nund' ? `${nundToFund(c.amount)} FUND` : `${c.amount} ${c.denom}`,
                      )
                      .join(', ')}
                  </dd>
                </>
              )}
              {proposal.proposer && (
                <>
                  <dt className="text-muted-foreground">
                    <Trans>Proposer</Trans>
                  </dt>
                  <dd className="font-mono break-all">{proposal.proposer}</dd>
                </>
              )}
            </dl>

            {proposal.failedReason && (
              <p className="text-destructive">
                <Trans>Failure reason: {proposal.failedReason}</Trans>
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm">
              <Trans>Tally</Trans>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-2 flex flex-col gap-2 text-xs">
            {total === 0n ? (
              <p className="text-muted-foreground italic">
                <Trans>No votes recorded yet.</Trans>
              </p>
            ) : (
              <>
                {/* Semantic-token tints per the v2 design system —
                  * automatically picks up the active theme's success /
                  * destructive / muted / accent colours instead of
                  * hardcoded Tailwind palette values that only worked on
                  * the original light-only Cosmos. */}
                <TallyBar
                  label={t`Yes`}
                  percent={pct.yes}
                  count={effectiveTally?.yesCount}
                  colour="bg-success"
                />
                <TallyBar
                  label={t`No`}
                  percent={pct.no}
                  count={effectiveTally?.noCount}
                  colour="bg-destructive"
                />
                <TallyBar
                  label={t`Abstain`}
                  percent={pct.abstain}
                  count={effectiveTally?.abstainCount}
                  colour="bg-muted-foreground"
                />
                <TallyBar
                  label={t`No with veto`}
                  percent={pct.noWithVeto}
                  count={effectiveTally?.noWithVetoCount}
                  colour="bg-accent"
                />
                <div className="border-t pt-2 mt-1 flex items-center justify-between text-[10px] uppercase tracking-[0.08em] font-mono text-muted-foreground">
                  <span>
                    {/*
                     * Quorum strip — designer-spec'd "✓ Reached / · In
                     * progress" CAPS strip. Full quorum-vs-staked-supply
                     * comparison needs the gov tallying-params query, which
                     * we don't yet hit; surfaced as "In progress" for now
                     * with a M13 follow-up to query the actual quorum + show
                     * Reached / Not reached. Total-stake-voted line stays as
                     * the visible scale anchor in the meantime.
                     */}
                    <Trans>Quorum · In progress</Trans>
                  </span>
                  <span>
                    <Trans>
                      Total{' '}
                      <span className="font-mono normal-case">
                        {nundToFund(total.toString())}
                      </span>{' '}
                      FUND
                    </Trans>
                  </span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {address && (
          <Card>
            <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm">
                <Trans>Your vote</Trans>
              </CardTitle>
              {isVoteable(proposal) && (
                <Button size="sm" className="h-7 text-xs" onClick={() => setVoteOpen(true)}>
                  {userVote ? <Trans>Change vote</Trans> : <Trans>Cast vote</Trans>}
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-4 pt-2 text-xs">
              {userVote ? (
                <p>
                  <Trans>
                    You voted{' '}
                    <span className="font-medium">
                      <VoteOptionText option={userVote.options[0]?.option} />
                    </span>
                  </Trans>
                </p>
              ) : isVoteable(proposal) ? (
                <p className="text-muted-foreground italic">
                  <Trans>You haven&apos;t voted on this proposal yet.</Trans>
                </p>
              ) : (
                <p className="text-muted-foreground italic">
                  <Trans>Voting is closed for this proposal.</Trans>
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <VoteModal
        open={voteOpen}
        onOpenChange={setVoteOpen}
        proposal={voteOpen ? proposal : null}
      />
    </>
  )
}

// ---------------------------------------------------------------------------
// Internal helpers / sub-components (kept private to this file)
// ---------------------------------------------------------------------------

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="outline" size="sm" className="h-7 text-xs self-start" onClick={onClick}>
      <Trans>← Back to list</Trans>
    </Button>
  )
}

function TallyBar({
  label,
  percent,
  count,
  colour,
}: {
  label: string
  percent: number
  count: string | undefined
  colour: string
}) {
  // Stacked labelled-row treatment per the M5 deliverable design system:
  // label + percentage on top (the easy-to-scan numbers), bar + raw count
  // below. Reads top-to-bottom rather than left-to-right, which gives the
  // tally section more vertical rhythm against the rest of the detail view.
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-[11px]">
        <span>{label}</span>
        <span className="tabular-nums font-mono">{percent.toFixed(2)}%</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 rounded bg-muted overflow-hidden">
          <div
            className={`h-full ${colour}`}
            style={{ width: `${percent.toString()}%` }}
          />
        </div>
        <span
          className="w-24 text-right tabular-nums font-mono text-[10px] text-muted-foreground"
          title={count ?? '0'}
        >
          {nundToFund(count)} FUND
        </span>
      </div>
    </div>
  )
}

function shortTypeUrl(typeUrl: string): string {
  // "/cosmos.gov.v1.MsgSoftwareUpgrade" → "MsgSoftwareUpgrade"
  // "/cosmos.upgrade.v1beta1.MsgSoftwareUpgrade" → "MsgSoftwareUpgrade"
  const last = typeUrl.split('.').pop()
  return last?.startsWith('Msg') ? last : typeUrl
}

function VoteOptionText({ option }: { option: VoteOption | undefined }) {
  switch (option) {
    case VoteOption.VOTE_OPTION_YES:
      return <Trans>Yes</Trans>
    case VoteOption.VOTE_OPTION_NO:
      return <Trans>No</Trans>
    case VoteOption.VOTE_OPTION_ABSTAIN:
      return <Trans>Abstain</Trans>
    case VoteOption.VOTE_OPTION_NO_WITH_VETO:
      return <Trans>No with veto</Trans>
    default:
      return <Trans>—</Trans>
  }
}
