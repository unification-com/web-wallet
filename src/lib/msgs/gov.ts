import { type EncodeObject } from '@cosmjs/proto-signing'
import { type StdFee } from '@cosmjs/stargate'
import { z } from 'zod'

import { VoteOption } from '@/lib/gov'

/**
 * Default fee for a `MsgVote` Tx. Vote messages are tiny + cheap — gas
 * comfortably covers the chain-side write. Mirrors `DEFAULT_STAKING_FEE`
 * sizing for consistency across modules.
 */
export const DEFAULT_VOTE_FEE: StdFee = {
  amount: [{ denom: 'nund', amount: '25000000' }],
  gas: '200000',
}

/**
 * Allowed vote options. Excludes `VOTE_OPTION_UNSPECIFIED` (0) and the
 * `UNRECOGNIZED` sentinel; only the four real options are user-selectable.
 */
const VOTE_OPTIONS: readonly VoteOption[] = [
  VoteOption.VOTE_OPTION_YES,
  VoteOption.VOTE_OPTION_NO,
  VoteOption.VOTE_OPTION_ABSTAIN,
  VoteOption.VOTE_OPTION_NO_WITH_VETO,
] as const

export const VoteFormSchema = z.object({
  /** Voter bech32 address — pre-filled from the active signer. */
  voter: z.string().regex(/^und1[a-z0-9]{38,58}$/, 'voter must be a valid und1… address'),
  /** Proposal id as a string (form field) — parsed to bigint at build time. */
  proposalId: z.string().regex(/^[1-9][0-9]*$/, 'proposal id must be a positive integer'),
  /** Picked option — gated by the radio UI. */
  option: z.number().refine((n): n is VoteOption => VOTE_OPTIONS.includes(n), {
    message: 'invalid vote option',
  }),
  /** Optional memo, capped at the standard 256-byte cosmos memo limit. */
  memo: z.string().max(256).optional(),
})

export type VoteFormValues = z.infer<typeof VoteFormSchema>

export interface BuildMsgVoteParams {
  proposalId: bigint
  voter: string
  option: VoteOption
  metadata?: string
}

/**
 * Build a `cosmos.gov.v1.MsgVote` EncodeObject. cosmjs's default registry
 * (in `SigningStargateClient.connectWithSigner` as of v0.38) registers
 * this typeUrl, so no extra registry plumbing is needed in `useSubmitTx`.
 */
export function buildMsgVote(params: BuildMsgVoteParams): EncodeObject {
  return {
    typeUrl: '/cosmos.gov.v1.MsgVote',
    value: {
      proposalId: params.proposalId,
      voter: params.voter,
      option: params.option,
      metadata: params.metadata ?? '',
    },
  }
}
