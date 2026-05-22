import { type EncodeObject } from '@cosmjs/proto-signing'
import { type StdFee } from '@cosmjs/stargate'
import { Trans, useLingui } from '@lingui/react/macro'
import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useActiveEndpoint } from '@/lib/chain'
import {
  buildFee,
  DEFAULT_MIN_GAS_PRICE_NUND,
  recommendedGas,
  simulateGas,
} from '@/lib/gasEstimate'
import { nundToFund } from '@/lib/msgs/send'
import { useActiveSigner } from '@/lib/signer'

interface GasAccordionProps {
  /**
   * The Msgs that will be broadcast — used by the on-demand simulate call
   * when the user expands the accordion. Function form so we don't pay
   * the per-keystroke rebuild cost; called only when the user clicks
   * Estimate.
   */
  buildMsgs: () => readonly EncodeObject[]
  memo?: string
  /** Default fee that applies when the user doesn't override. */
  defaultFee: StdFee
  /**
   * Called with the effective fee — either the default (user untouched)
   * or the override built from the gas + gas-price inputs.
   */
  onFeeChange: (fee: StdFee) => void
}

/**
 * Collapsible "Advanced" panel inside `<TxModal />` exposing gas
 * estimation + manual override. Default behaviour: emit the `defaultFee`
 * unchanged. When the user opens the accordion and edits gas / gas-price,
 * emit a freshly-built `StdFee` instead. An on-demand "Estimate" button
 * runs a dry-run simulate against the active endpoint + signer and
 * surfaces the resulting gas with a 1.4× safety margin pre-applied.
 *
 * No simulation runs automatically — keystroke-driven simulation would
 * spam the RPC. The user expands → clicks Estimate → reviews → optionally
 * applies. Power-user surface; out of the user's way by default.
 */
export function GasAccordion({
  buildMsgs,
  memo,
  defaultFee,
  onFeeChange,
}: GasAccordionProps) {
  const endpoint = useActiveEndpoint()
  const { signer, address } = useActiveSigner()
  const { t } = useLingui()
  const [expanded, setExpanded] = useState(false)

  // Initial values from the default fee. User edits drift these — when
  // they differ from the originals we emit a custom fee, otherwise the
  // default flows through unchanged.
  const defaultGas = Number(defaultFee.gas)
  const defaultFeeAmount = Number(defaultFee.amount[0]?.amount ?? '0')
  const defaultGasPrice =
    defaultGas > 0 ? defaultFeeAmount / defaultGas : DEFAULT_MIN_GAS_PRICE_NUND

  const [gas, setGas] = useState<number>(defaultGas)
  const [gasPrice, setGasPrice] = useState<number>(defaultGasPrice)
  const [simulated, setSimulated] = useState<number | null>(null)
  const [simulating, setSimulating] = useState(false)
  const [simError, setSimError] = useState<string | null>(null)

  // Emit the effective fee whenever the user edits the inputs.
  useEffect(() => {
    const isDefault = gas === defaultGas && gasPrice === defaultGasPrice
    onFeeChange(isDefault ? defaultFee : buildFee(gas, gasPrice))
  }, [gas, gasPrice, defaultGas, defaultGasPrice, defaultFee, onFeeChange])

  const onEstimate = async () => {
    if (!signer || !address) {
      setSimError(t`unlock the vault first`)
      return
    }
    setSimulating(true)
    setSimError(null)
    try {
      const msgs = buildMsgs()
      if (msgs.length === 0) {
        setSimError(t`fill in the form first — nothing to estimate`)
        return
      }
      const result = await simulateGas({
        endpoint,
        signer,
        signerAddress: address,
        msgs,
        ...(memo ? { memo } : {}),
      })
      setSimulated(result)
    } catch (err) {
      setSimError(
        err instanceof Error
          ? err.message
          : t`simulation failed — the chain rejected the dry-run`,
      )
    } finally {
      setSimulating(false)
    }
  }

  const applyEstimate = () => {
    if (simulated === null) return
    setGas(recommendedGas(simulated))
  }

  const reset = () => {
    setGas(defaultGas)
    setGasPrice(defaultGasPrice)
    setSimulated(null)
    setSimError(null)
  }

  const effectiveFeeNund = Math.ceil(gas * gasPrice)

  return (
    <div className="border-t pt-2 mt-1">
      <button
        type="button"
        onClick={() => setExpanded((s) => !s)}
        className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
      >
        {expanded ? (
          <ChevronDown className="h-3 w-3" />
        ) : (
          <ChevronRight className="h-3 w-3" />
        )}
        <Trans>Advanced: gas + fee</Trans>
      </button>

      {expanded && (
        <div className="flex flex-col gap-2 mt-2 text-[11px]">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-[11px]"
              disabled={simulating}
              // eslint-disable-next-line @typescript-eslint/no-misused-promises
              onClick={onEstimate}
            >
              {simulating ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <Trans>Estimating…</Trans>
                </>
              ) : (
                <Trans>Estimate from chain</Trans>
              )}
            </Button>
            {simulated !== null && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-[11px]"
                onClick={applyEstimate}
                title={t`Set gas to estimate × 1.4 safety margin`}
              >
                <Trans>Apply estimate</Trans>
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-[11px]"
              onClick={reset}
            >
              <Trans>Reset</Trans>
            </Button>
          </div>

          {simulated !== null && (
            <p className="text-muted-foreground">
              <Trans>
                Simulated gas:{' '}
                <span className="font-mono">{simulated.toString()}</span> · recommended (×1.4):{' '}
                <span className="font-mono">{recommendedGas(simulated).toString()}</span>
              </Trans>
            </p>
          )}
          {simError && <p className="text-destructive break-words">{simError}</p>}

          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="gas-input" className="text-[11px]">
                <Trans>Gas</Trans>
              </Label>
              <Input
                id="gas-input"
                type="number"
                value={gas}
                min={1}
                onChange={(e) => setGas(Number(e.target.value) || 0)}
                className="font-mono text-xs h-8"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="gas-price-input" className="text-[11px]">
                <Trans>Price (nund/gas)</Trans>
              </Label>
              <Input
                id="gas-price-input"
                type="number"
                value={gasPrice}
                min={0}
                step="any"
                onChange={(e) => setGasPrice(Number(e.target.value) || 0)}
                className="font-mono text-xs h-8"
              />
            </div>
          </div>
          <p className="text-muted-foreground">
            <Trans>
              Fee:{' '}
              <span className="font-mono">{effectiveFeeNund.toString()}</span> nund (
              <span className="font-mono">{nundToFund(effectiveFeeNund.toString())}</span> FUND).
              Chain floor is{' '}
              <span className="font-mono">{DEFAULT_MIN_GAS_PRICE_NUND.toString()}</span> nund/gas.
            </Trans>
          </p>
        </div>
      )}
    </div>
  )
}
