import { Trans, useLingui } from '@lingui/react/macro'
import { useEffect, useState } from 'react'

import { TxModal } from '@/components/TxModal'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { VoteOption, type Proposal } from '@/lib/gov'
import { buildMsgVote, DEFAULT_VOTE_FEE } from '@/lib/msgs/gov'
import { useActiveSigner } from '@/lib/signer'

interface VoteModalProps {
  open: boolean
  onOpenChange: (next: boolean) => void
  /** Proposal being voted on. Null disables the modal. */
  proposal: Proposal | null
}

/**
 * Cast a vote (`MsgVote`) on an active proposal. Yes / No / Abstain /
 * NoWithVeto radio + optional memo + confirmation via the shared
 * `<TxModal />` shell. On success the parent's `useUserVote` + `useTally…`
 * queries invalidate so the vote indicator + tally bars refresh immediately.
 */
export function VoteModal({ open, onOpenChange, proposal }: VoteModalProps) {
  const { address } = useActiveSigner()
  const { t } = useLingui()
  const [option, setOption] = useState<VoteOption>(VoteOption.VOTE_OPTION_YES)
  const [memo, setMemo] = useState('')

  // Reset choice + memo whenever the modal opens against a new proposal.
  useEffect(() => {
    if (open) {
      setOption(VoteOption.VOTE_OPTION_YES)
      setMemo('')
    }
  }, [open, proposal?.id])

  const canSubmit = !!address && !!proposal

  return (
    <TxModal
      open={open}
      onOpenChange={onOpenChange}
      title={<Trans>Vote on proposal #{proposal?.id.toString() ?? ''}</Trans>}
      description={
        <Trans>
          Cast a vote on this active proposal. Your choice is recorded on-chain against your
          account and weighted by your staked FUND at the voting-period snapshot.
        </Trans>
      }
      formBody={
        <div className="flex flex-col gap-3 text-sm">
          <p className="text-xs text-muted-foreground truncate" title={proposal?.title}>
            {proposal?.title ?? ''}
          </p>

          <fieldset className="flex flex-col gap-2">
            <legend className="text-xs font-medium mb-1">
              <Trans>Your choice</Trans>
            </legend>
            <VoteRadio
              name="vote-option"
              value={VoteOption.VOTE_OPTION_YES}
              current={option}
              onChange={setOption}
              label={t`Yes`}
              hint={t`I support this proposal`}
            />
            <VoteRadio
              name="vote-option"
              value={VoteOption.VOTE_OPTION_NO}
              current={option}
              onChange={setOption}
              label={t`No`}
              hint={t`I oppose this proposal`}
            />
            <VoteRadio
              name="vote-option"
              value={VoteOption.VOTE_OPTION_ABSTAIN}
              current={option}
              onChange={setOption}
              label={t`Abstain`}
              hint={t`Don't count my stake for or against`}
            />
            <VoteRadio
              name="vote-option"
              value={VoteOption.VOTE_OPTION_NO_WITH_VETO}
              current={option}
              onChange={setOption}
              label={t`No with veto`}
              hint={t`Strong rejection — if more than 33.4% veto, proposal is rejected and deposit burned`}
            />
          </fieldset>

          <div className="flex flex-col gap-1">
            <Label htmlFor="vote-memo">
              <Trans>Memo (optional)</Trans>
            </Label>
            <Input
              id="vote-memo"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              maxLength={256}
            />
          </div>
        </div>
      }
      canSubmit={canSubmit}
      buildMsgs={() => {
        if (!address || !proposal) return []
        return [buildMsgVote({ proposalId: proposal.id, voter: address, option })]
      }}
      fee={DEFAULT_VOTE_FEE}
      {...(memo ? { memo } : {})}
      invalidateQueryKeys={[
        ['gov', 'vote'],
        ['gov', 'tally'],
        ['gov', 'proposals'],
        ['gov', 'proposal'],
      ]}
      confirmLabel={t`Cast vote`}
    />
  )
}

/**
 * Radio-row helper for the vote-option fieldset. Pulled out as a tiny
 * component so the four option rows stay declarative + symmetric in the
 * parent (DRY — four near-identical rows would be a smell otherwise).
 */
function VoteRadio({
  name,
  value,
  current,
  onChange,
  label,
  hint,
}: {
  name: string
  value: VoteOption
  current: VoteOption
  onChange: (next: VoteOption) => void
  label: string
  hint: string
}) {
  const id = `${name}-${String(value)}`
  // jsx-a11y's default `label-has-associated-control` check doesn't trace
  // text through nested `<span>` descendants, but the label DOES carry an
  // associated control (the radio input it wraps) AND visible text (the
  // `<span>{label}</span>` child) — accessibility is intact. Disable the
  // rule for this specific element with the rationale captured here.
  return (
    // eslint-disable-next-line jsx-a11y/label-has-associated-control
    <label
      htmlFor={id}
      className="flex items-start gap-2 cursor-pointer rounded border border-border p-2 hover:bg-muted/50"
    >
      <input
        type="radio"
        id={id}
        name={name}
        value={value}
        checked={current === value}
        onChange={() => onChange(value)}
        className="mt-0.5"
      />
      <span className="flex flex-col">
        <span className="font-medium">{label}</span>
        <span className="text-[11px] text-muted-foreground">{hint}</span>
      </span>
    </label>
  )
}
