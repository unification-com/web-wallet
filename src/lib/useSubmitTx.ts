import { type EncodeObject, type OfflineDirectSigner } from '@cosmjs/proto-signing'
import {
  type DeliverTxResponse,
  SigningStargateClient,
  type StdFee,
} from '@cosmjs/stargate'
import { useCallback, useState } from 'react'

import { useActiveEndpoint, type ChainEndpoint } from './chain'
import { useActiveSigner } from './signer'

// ---------------------------------------------------------------------------
// Pure submitter — testable without React. The hook below wraps it.
// ---------------------------------------------------------------------------

export interface SubmitTxParams {
  endpoint: ChainEndpoint
  signer: OfflineDirectSigner
  signerAddress: string
  msgs: readonly EncodeObject[]
  fee: StdFee | 'auto'
  memo?: string
}

/**
 * Sign + broadcast a transaction. Throws on:
 *   - cosmjs connection / signing failure
 *   - `result.code !== 0` (chain rejected the tx — surfaces `rawLog` in the message)
 *
 * Returns the full `DeliverTxResponse` (`transactionHash`, `height`, `gasUsed`,
 * `events`, `rawLog`) on success.
 *
 * Connects + disconnects per call. For a wallet-popup use case the overhead
 * is negligible (one Tx per user click); a long-lived dApp might want to
 * cache the client elsewhere.
 */
export async function submitTx(params: SubmitTxParams): Promise<DeliverTxResponse> {
  const client = await SigningStargateClient.connectWithSigner(
    params.endpoint.rpc,
    params.signer,
  )
  try {
    const result = await client.signAndBroadcast(
      params.signerAddress,
      [...params.msgs],
      params.fee,
      params.memo,
    )
    if (result.code !== 0) {
      throw new Error(
        `transaction rejected (code=${result.code.toString()}): ${result.rawLog ?? 'unknown error'}`,
      )
    }
    return result
  } finally {
    client.disconnect()
  }
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

export interface SubmitTxInput {
  msgs: readonly EncodeObject[]
  fee: StdFee | 'auto'
  memo?: string
}

export interface UseSubmitTxResult {
  /**
   * Sign + broadcast. Returns the chain's `DeliverTxResponse` on success;
   * throws on any failure (also stored in `error`). Updates `submitting`,
   * `txHash`, and `error` state for UI binding.
   */
  submit: (input: SubmitTxInput) => Promise<DeliverTxResponse>
  submitting: boolean
  error: Error | null
  txHash: string | null
  reset: () => void
}

/**
 * The DRY entry point every Tx-submitting flow uses (M3 staking, M4 governance,
 * M6 streams, M7 enterprise — all consume this). Pulls the active signer +
 * active endpoint from the vault store, exposes a single `submit(input)` that
 * handles state transitions + error mapping.
 *
 * In M2, Keplr/Leap/Cosmostation signers slot in via `useActiveSigner`'s
 * extended union — every consumer of this hook keeps working unchanged.
 */
export function useSubmitTx(): UseSubmitTxResult {
  const endpoint = useActiveEndpoint()
  const { signer, address } = useActiveSigner()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [txHash, setTxHash] = useState<string | null>(null)

  const reset = useCallback(() => {
    setSubmitting(false)
    setError(null)
    setTxHash(null)
  }, [])

  const submit = useCallback(
    async (input: SubmitTxInput): Promise<DeliverTxResponse> => {
      if (!signer || !address) {
        throw new Error('no active signer — unlock the vault and select an account')
      }
      setSubmitting(true)
      setError(null)
      setTxHash(null)
      try {
        const result = await submitTx({
          endpoint,
          signer,
          signerAddress: address,
          msgs: input.msgs,
          fee: input.fee,
          // Conditional spread — exactOptionalPropertyTypes forbids explicit
          // `memo: undefined` on an object whose target field is `memo?: string`.
          ...(input.memo !== undefined ? { memo: input.memo } : {}),
        })
        setTxHash(result.transactionHash)
        return result
      } catch (e: unknown) {
        const err = e instanceof Error ? e : new Error(String(e))
        setError(err)
        throw err
      } finally {
        setSubmitting(false)
      }
    },
    [endpoint, signer, address],
  )

  return { submit, submitting, error, txHash, reset }
}
