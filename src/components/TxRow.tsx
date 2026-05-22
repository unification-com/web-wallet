import { Trans, useLingui } from '@lingui/react/macro'
import { ArrowDownLeft, ArrowUpRight, ChevronDown, ChevronRight, ExternalLink, Info } from 'lucide-react'
import { useMemo, useState } from 'react'

import { txExplorerUrl, useActiveEndpoint } from '@/lib/chain'
import {
  presentMsg,
  shortTypeUrl,
  type PresenterItem,
  type PresenterResult,
  type TxDirection,
} from '@/lib/msgs/presenters'
import { nundToFund } from '@/lib/msgs/send'
import type { DecodedIndexedTx } from '@/lib/txhistory'

interface TxRowProps {
  tx: DecodedIndexedTx
  activeAddress: string
}

/**
 * Single tx-history row. Structure preserved from the previous design;
 * only the direction badge / failed badge / chevron treatment have moved
 * to the new tokens so the row inherits the active theme.
 */
export function TxRow({ tx, activeAddress }: TxRowProps) {
  const { t } = useLingui()
  const endpoint = useActiveEndpoint()
  const [expanded, setExpanded] = useState(false)

  const presented = useMemo<PresenterResult[]>(
    () =>
      tx.decoded.body.messages.map((m, i) =>
        presentMsg(m, { address: activeAddress, events: tx.events, msgIndex: i }),
      ),
    [tx.decoded.body.messages, tx.events, activeAddress],
  )

  const headlineVerb = presented[0]?.verb ?? t`(no messages)`
  const headlineDirection: TxDirection = presented[0]?.direction ?? 'info'
  const additional = presented.length - 1

  const explorerHref = txExplorerUrl(endpoint, tx.hash)
  const fee = tx.decoded.authInfo.fee
  const memo = tx.decoded.body.memo

  return (
    <li className="flex flex-col gap-1 border border-border rounded bg-card p-2.5 text-xs">
      <button
        type="button"
        className="flex items-start gap-2 text-left w-full"
        onClick={() => setExpanded((s) => !s)}
      >
        {expanded ? (
          <ChevronDown className="h-3 w-3 mt-1 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3 w-3 mt-1 shrink-0 text-muted-foreground" />
        )}
        <DirectionGlyph direction={headlineDirection} />
        <span className="flex flex-col flex-1 min-w-0">
          <span className="flex items-center gap-2">
            <span className="font-medium truncate">
              {headlineVerb}
              {additional > 0 && (
                <span className="text-muted-foreground">
                  <Trans> + {additional.toString()} more</Trans>
                </span>
              )}
            </span>
            <DirectionBadge direction={headlineDirection} />
            {tx.code !== 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded uppercase tracking-[0.08em] font-mono font-semibold bg-destructive/15 text-destructive border border-destructive/30">
                <Trans>Failed</Trans>
              </span>
            )}
          </span>
          <span className="text-[10px] text-muted-foreground font-mono">
            <Trans>
              h{tx.height.toString()} · {presented.length.toString()}{' '}
              {presented.length === 1 ? <>msg</> : <>msgs</>}
            </Trans>
          </span>
        </span>
      </button>

      {expanded && (
        <div className="flex flex-col gap-2 pl-5 pt-1">
          {/* Per-message details */}
          <ul className="flex flex-col gap-2">
            {presented.map((p, i) => (
              <li
                key={`${tx.hash}-msg-${i.toString()}`}
                className="rounded border border-border bg-surface-sunk p-2 flex flex-col gap-1"
              >
                <span className="font-medium flex items-center gap-2">
                  {p.verb}
                  <DirectionBadge direction={p.direction} />
                  <span className="ml-auto text-[10px] text-muted-foreground font-mono">
                    {shortTypeUrl(tx.decoded.body.messages[i]?.typeUrl ?? '')}
                  </span>
                </span>
                {p.items.length > 0 && <PresenterItemList items={p.items} />}
              </li>
            ))}
          </ul>

          {/* Tx-level metadata */}
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[11px]">
            <dt className="text-muted-foreground">
              <Trans>Hash</Trans>
            </dt>
            <dd className="font-mono break-all">
              {explorerHref ? (
                <a
                  href={explorerHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-1"
                  title={t`Open in block explorer`}
                >
                  {tx.hash}
                  <ExternalLink className="h-3 w-3 shrink-0" />
                </a>
              ) : (
                tx.hash
              )}
            </dd>

            <dt className="text-muted-foreground">
              <Trans>Height</Trans>
            </dt>
            <dd className="font-mono">{tx.height.toString()}</dd>

            <dt className="text-muted-foreground">
              <Trans>Fee</Trans>
            </dt>
            <dd className="font-mono">
              {fee && fee.amount.length > 0
                ? fee.amount
                    .map((c) =>
                      c.denom === 'nund' ? `${nundToFund(c.amount)} FUND` : `${c.amount} ${c.denom}`,
                    )
                    .join(', ')
                : '—'}
              {fee?.gasLimit !== undefined && fee.gasLimit > 0n && (
                <span className="text-muted-foreground">
                  {' '}
                  <Trans>(gas {fee.gasLimit.toString()})</Trans>
                </span>
              )}
            </dd>

            <dt className="text-muted-foreground">
              <Trans>Gas used</Trans>
            </dt>
            <dd className="font-mono">
              {tx.gasUsed.toString()} / {tx.gasWanted.toString()}
            </dd>

            {memo && (
              <>
                <dt className="text-muted-foreground">
                  <Trans>Memo</Trans>
                </dt>
                <dd className="break-words">{memo}</dd>
              </>
            )}

            {tx.code !== 0 && (
              <>
                <dt className="text-muted-foreground">
                  <Trans>Code</Trans>
                </dt>
                <dd className="font-mono text-destructive">{tx.code.toString()}</dd>
              </>
            )}
          </dl>
        </div>
      )}
    </li>
  )
}

function PresenterItemList({ items }: { items: readonly PresenterItem[] }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[11px]">
      {items.map((item, i) => (
        <PresenterItemRow key={`${item.label}-${i.toString()}`} item={item} />
      ))}
    </dl>
  )
}

function PresenterItemRow({ item }: { item: PresenterItem }) {
  return (
    <>
      <dt className="text-muted-foreground">{item.label}</dt>
      <dd className={`break-all ${item.mono ? 'font-mono' : ''}`}>{item.value}</dd>
    </>
  )
}

/**
 * Leading glyph in the row header — colour-coded soft-pill icon. Reads at
 * a glance ahead of the direction badge text. Keeps WCAG AA without
 * relying on colour alone (the badge text remains).
 *
 * Colour mapping:
 *   received → success (green)    — FUND came in (incl. claim rewards)
 *   sent     → muted/neutral     — FUND went out (transfer, delegate, redelegate)
 *   info     → primary (blue)    — governance vote, no-op message
 *
 * Destructive red is reserved for the FAILED tx badge — NOT for
 * sent-direction rows, because most "sent" messages in this wallet are
 * legitimate staking ops that shouldn't read as alarming.
 */
function DirectionGlyph({ direction }: { direction: TxDirection }) {
  const cls = 'h-3.5 w-3.5'
  switch (direction) {
    case 'sent':
      return (
        <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded bg-muted text-muted-foreground">
          <ArrowUpRight className={cls} />
        </span>
      )
    case 'received':
      return (
        <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded bg-success/15 text-success">
          <ArrowDownLeft className={cls} />
        </span>
      )
    default:
      return (
        <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded bg-primary/15 text-primary">
          <Info className={cls} />
        </span>
      )
  }
}

function DirectionBadge({ direction }: { direction: TxDirection }) {
  const { t } = useLingui()
  let label: string
  let cls: string
  switch (direction) {
    case 'sent':
      label = t`Sent`
      cls = 'bg-muted text-muted-foreground border-border'
      break
    case 'received':
      label = t`Received`
      cls = 'bg-success/12 text-success border-success/30'
      break
    default:
      label = t`Info`
      cls = 'bg-primary/10 text-primary border-primary/30'
  }
  return (
    <span
      className={`text-[10px] px-1.5 py-0.5 rounded uppercase tracking-[0.08em] font-mono font-semibold shrink-0 border ${cls}`}
    >
      {label}
    </span>
  )
}
