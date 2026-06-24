import { Trans, useLingui } from '@lingui/react/macro'
import { useMemo, useState } from 'react'

import { ProposalStatusBadge } from '@/components/ProposalStatusBadge'
import { RefreshButton } from '@/components/RefreshButton'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ProposalStatus,
  getProposalTitle,
  isVoteable,
  sortProposals,
  useProposals,
  type Proposal,
} from '@/lib/gov'
import { formatRelativeDeadline, timestampToDate, useTickingNow } from '@/lib/time'

interface ProposalListProps {
  onSelect: (proposalId: bigint) => void
}

/**
 * Paginated proposal list with a status-filter dropdown. Voting-period
 * proposals always rank above other statuses regardless of id (most
 * actionable first); within a status bucket the order is descending id
 * (newest first).
 *
 * Filtering is server-side via the gov module's `proposal_status`
 * request field — `PROPOSAL_STATUS_UNSPECIFIED` returns everything;
 * the dropdown narrows to a specific status.
 */
export function ProposalList({ onSelect }: ProposalListProps) {
  const { t } = useLingui()
  const [statusFilter, setStatusFilter] = useState<ProposalStatus>(
    ProposalStatus.PROPOSAL_STATUS_UNSPECIFIED,
  )
  const { data: proposals, isLoading, isError, error } = useProposals(statusFilter)
  const now = useTickingNow(60_000)

  const sorted = useMemo(() => sortProposals(proposals ?? []), [proposals])

  return (
    <Card>
      <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0 gap-2">
        <CardTitle className="text-sm">
          <Trans>Proposals</Trans>
        </CardTitle>
        <div className="flex items-center gap-1">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(Number(e.target.value))}
            className="h-7 rounded-md border border-input bg-background px-2 text-[11px]"
          >
            <option value={ProposalStatus.PROPOSAL_STATUS_UNSPECIFIED}>{t`All`}</option>
            <option value={ProposalStatus.PROPOSAL_STATUS_VOTING_PERIOD}>{t`Voting`}</option>
            <option value={ProposalStatus.PROPOSAL_STATUS_DEPOSIT_PERIOD}>{t`Deposit`}</option>
            <option value={ProposalStatus.PROPOSAL_STATUS_PASSED}>{t`Passed`}</option>
            <option value={ProposalStatus.PROPOSAL_STATUS_REJECTED}>{t`Rejected`}</option>
            <option value={ProposalStatus.PROPOSAL_STATUS_FAILED}>{t`Failed`}</option>
          </select>
          <RefreshButton queryKeys={[['gov']]} />
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-2 flex flex-col gap-2 text-xs">
        {isLoading && (
          <p className="text-muted-foreground">
            <Trans>Loading proposals…</Trans>
          </p>
        )}
        {isError && (
          <p className="text-destructive">
            <Trans>
              Failed to load proposals: {error instanceof Error ? error.message : String(error)}
            </Trans>
          </p>
        )}
        {!isLoading && !isError && sorted.length === 0 && (
          <p className="text-muted-foreground italic">
            <Trans>No proposals match this filter.</Trans>
          </p>
        )}
        <ul className="flex flex-col gap-1">
          {sorted.map((p) => (
            <ProposalRow key={p.id.toString()} proposal={p} now={now} onSelect={onSelect} />
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

function ProposalRow({
  proposal,
  now,
  onSelect,
}: {
  proposal: Proposal
  now: Date
  onSelect: (id: bigint) => void
}) {
  const votingEnd = timestampToDate(proposal.votingEndTime)
  const votingEndRel = votingEnd ? formatRelativeDeadline(votingEnd, now) : undefined
  // Falls back to the wrapped v1beta1 TextProposal.title when the v1
  // top-level title is empty (older proposals submitted via the legacy
  // MsgExecLegacyContent route).
  const title = getProposalTitle(proposal)

  return (
    <li>
      <Button
        variant="ghost"
        className="w-full justify-start h-auto p-2 text-left flex items-start gap-2 hover:bg-muted/50"
        onClick={() => onSelect(proposal.id)}
      >
        <span className="font-mono text-[11px] text-muted-foreground mt-0.5 shrink-0">
          #{proposal.id.toString()}
        </span>
        <span className="flex flex-col flex-1 min-w-0">
          <span className="font-medium truncate" title={title}>
            {title || <Trans>(untitled)</Trans>}
          </span>
          {isVoteable(proposal) && votingEndRel && !votingEndRel.complete && (
            <span className="text-[10px] text-muted-foreground">
              <Trans>voting ends {votingEndRel.label}</Trans>
            </span>
          )}
        </span>
        <ProposalStatusBadge status={proposal.status} size="sm" />
      </Button>
    </li>
  )
}
