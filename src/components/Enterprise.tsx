import { Trans, useLingui } from '@lingui/react/macro'
import { useState } from 'react'

import { RaisePurchaseOrderModal } from '@/components/RaisePurchaseOrderModal'
import { RefreshButton } from '@/components/RefreshButton'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useActiveEndpoint } from '@/lib/chain'
import {
  PurchaseOrderStatus,
  sortPurchaseOrders,
  statusLabel,
  useIsWhitelisted,
  useLockedFund,
  usePurchaseOrders,
  type EnterpriseUndPurchaseOrder,
} from '@/lib/enterprise'
import { nundToFund } from '@/lib/msgs/send'
import { useActiveSigner } from '@/lib/signer'

/**
 * Enterprise tab — purchase-order surface for whitelisted accounts.
 *
 * Layout:
 *   1. Locked-eFUND balance card (always shown when address is set —
 *      surfaces what the chain has already minted, regardless of whitelist
 *      status).
 *   2. Whitelist-gated "Raise PO" affordance:
 *        - whitelisted: button opens RaisePurchaseOrderModal
 *        - not whitelisted: explainer card (mirrors v1's `!entWhitelisted` block)
 *   3. PO history list (most-recent first; status-coloured chip per row).
 */
export function Enterprise() {
  const { address } = useActiveSigner()
  const { t } = useLingui()
  const whitelisted = useIsWhitelisted(address)
  const locked = useLockedFund(address)
  const orders = usePurchaseOrders(address, PurchaseOrderStatus.STATUS_NIL)
  const [raiseOpen, setRaiseOpen] = useState(false)

  if (!address) return null

  const sorted = sortPurchaseOrders(orders.data ?? [])

  return (
    <>
      <Card>
        <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0 gap-2">
          <CardTitle className="text-sm">
            <Trans>Enterprise eFUND</Trans>
          </CardTitle>
          <RefreshButton queryKeys={[['enterprise']]} />
        </CardHeader>
        <CardContent className="p-4 pt-2 flex flex-col gap-2 text-xs">
          <p>
            <Trans>
              Enterprise members raise purchase orders for eFUND — a locked
              balance the chain mints to pay BEACON / WRKCHAIN / stream
              creation fees. eFUND can&apos;t be transferred or used outside
              chain fees.
            </Trans>
          </p>
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.06em]">
              <Trans>Locked balance</Trans>
            </span>
            <span className="font-mono font-medium tabular-nums">
              {locked.isLoading ? (
                <Trans>loading…</Trans>
              ) : (
                <>
                  {nundToFund(locked.data?.amount ?? '0')}{' '}
                  {locked.data?.denom === 'nund' ? 'FUND' : (locked.data?.denom ?? '')}
                </>
              )}
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm">
            <Trans>Raise a purchase order</Trans>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-2 flex flex-col gap-2 text-xs">
          {whitelisted.isLoading && (
            <p className="text-muted-foreground italic">
              <Trans>Checking whitelist…</Trans>
            </p>
          )}
          {!whitelisted.isLoading && whitelisted.data === true && (
            <div className="flex items-center justify-between gap-2">
              <p className="text-muted-foreground">
                <Trans>This account is whitelisted to raise enterprise POs.</Trans>
              </p>
              <Button
                variant="brand"
                size="sm"
                onClick={() => setRaiseOpen(true)}
                className="h-7 text-xs shrink-0"
              >
                <Trans>Raise PO</Trans>
              </Button>
            </div>
          )}
          {!whitelisted.isLoading && whitelisted.data === false && (
            <p className="text-muted-foreground italic">
              <Trans>
                This account isn&apos;t on the enterprise whitelist. POs can only
                be raised by approved enterprise members. Contact an
                administrator to be added.
              </Trans>
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0 gap-2">
          <CardTitle className="text-sm">
            <Trans>Purchase order history</Trans>
          </CardTitle>
          <RefreshButton queryKeys={[['enterprise', 'orders']]} />
        </CardHeader>
        <CardContent className="p-4 pt-2 flex flex-col gap-2 text-xs">
          {orders.isLoading && (
            <p className="text-muted-foreground">
              <Trans>Loading purchase orders…</Trans>
            </p>
          )}
          {!orders.isLoading && sorted.length === 0 && (
            <p className="text-muted-foreground italic">
              <Trans>No purchase orders yet.</Trans>
            </p>
          )}
          <ul className="flex flex-col gap-2">
            {sorted.map((po) => (
              <PurchaseOrderRow key={po.id.toString()} po={po} t={t} />
            ))}
          </ul>
        </CardContent>
      </Card>

      <RaisePurchaseOrderModal open={raiseOpen} onOpenChange={setRaiseOpen} />
    </>
  )
}

interface PurchaseOrderRowProps {
  po: EnterpriseUndPurchaseOrder
  t: ReturnType<typeof useLingui>['t']
}

function PurchaseOrderRow({ po }: PurchaseOrderRowProps) {
  const endpoint = useActiveEndpoint()
  const status = statusLabel(po.status)
  const denomLabel = po.amount.denom === 'nund' ? 'FUND' : po.amount.denom

  // raise_time is unix seconds. Convert to a JS Date for locale formatting.
  const raisedAt = po.raiseTime > 0n ? new Date(Number(po.raiseTime) * 1000) : null

  return (
    <li className="flex flex-col gap-1 rounded border border-border p-2">
      <div className="flex items-center justify-between gap-2">
        <span className="flex flex-col min-w-0 gap-0.5">
          <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.06em]">
            <Trans>PO #{po.id.toString()}</Trans>
          </span>
          <span className="text-[10px] text-muted-foreground">
            {raisedAt ? raisedAt.toLocaleString() : '—'}
          </span>
        </span>
        <span className="flex flex-col items-end tabular-nums">
          <PurchaseOrderStatusChip status={status} />
          <span className="font-mono font-medium">
            {nundToFund(po.amount.amount)} {denomLabel}
          </span>
        </span>
      </div>
      {endpoint.txExplorerBase && (
        <span className="text-[10px] text-muted-foreground">
          <Trans>Chain-side processing — admin actions don&apos;t appear in your tx history.</Trans>
        </span>
      )}
    </li>
  )
}

function PurchaseOrderStatusChip({ status }: { status: string }) {
  const cls = (() => {
    switch (status) {
      case 'raised':
        return 'bg-muted text-muted-foreground'
      case 'accepted':
        return 'bg-success/15 text-success'
      case 'rejected':
        return 'bg-destructive/15 text-destructive'
      case 'completed':
        return 'bg-primary/15 text-primary'
      default:
        return 'bg-muted text-muted-foreground'
    }
  })()
  return (
    <span
      className={
        'px-1.5 py-0.5 rounded font-mono uppercase tracking-[0.06em] text-[9px] font-semibold ' +
        cls
      }
    >
      <StatusLabel status={status} />
    </span>
  )
}

function StatusLabel({ status }: { status: string }) {
  switch (status) {
    case 'raised':
      return <Trans>Raised</Trans>
    case 'accepted':
      return <Trans>Accepted</Trans>
    case 'rejected':
      return <Trans>Rejected</Trans>
    case 'completed':
      return <Trans>Completed</Trans>
    default:
      return <Trans>Unknown</Trans>
  }
}
