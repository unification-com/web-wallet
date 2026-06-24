import { useLingui } from '@lingui/react/macro'

import { ProposalStatus } from '@/lib/gov'

interface ProposalStatusBadgeProps {
  status: ProposalStatus
  /** `sm` for inline list rows; `md` for detail-view headers. */
  size?: 'sm' | 'md'
}

/**
 * Shared status pill for proposal status. Used by both `<ProposalList />`
 * (small pill in each row) and `<ProposalDetail />` (larger pill in the
 * header). Centralising the label + colour mapping prevents the two
 * surfaces drifting out of sync.
 */
export function ProposalStatusBadge({ status, size = 'sm' }: ProposalStatusBadgeProps) {
  const { t } = useLingui()
  let label: string
  let cls: string
  switch (status) {
    case ProposalStatus.PROPOSAL_STATUS_VOTING_PERIOD:
      label = t`Voting`
      cls = 'bg-amber-100 text-amber-900'
      break
    case ProposalStatus.PROPOSAL_STATUS_DEPOSIT_PERIOD:
      label = t`Deposit`
      cls = 'bg-slate-200 text-slate-700'
      break
    case ProposalStatus.PROPOSAL_STATUS_PASSED:
      label = t`Passed`
      cls = 'bg-green-100 text-green-900'
      break
    case ProposalStatus.PROPOSAL_STATUS_REJECTED:
      label = t`Rejected`
      cls = 'bg-red-100 text-red-900'
      break
    case ProposalStatus.PROPOSAL_STATUS_FAILED:
      label = t`Failed`
      cls = 'bg-red-100 text-red-900'
      break
    default:
      label = size === 'sm' ? t`?` : t`Unknown`
      cls = 'bg-muted text-muted-foreground'
  }
  const padding = size === 'sm' ? 'px-1.5 py-0.5' : 'px-2 py-0.5'
  return (
    <span
      className={`text-[10px] ${padding} rounded uppercase tracking-wider shrink-0 ${cls}`}
    >
      {label}
    </span>
  )
}
