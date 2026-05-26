import { useLingui } from '@lingui/react/macro'
import { Check, Pencil, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { useVaultStore } from '@/lib/vault'

interface StreamLabelProps {
  sender: string
  receiver: string
  denom: string
  /** Counterparty address rendered as the fallback when no label is set. */
  counterparty: string
  className?: string
}

/**
 * Edit-in-place stream label. Tap the pencil icon to swap the bech32 line
 * for an `<input>`; Enter or check icon saves, Esc or cross cancels. Empty
 * input clears the label and falls back to the bech32 default rendering.
 *
 * Labels are stored in the encrypted vault keyed by the stream's identity
 * triple `(sender, receiver, denom)` — each user's vault holds their own
 * labels, so sender and receiver can name the same on-chain stream
 * independently.
 */
export function StreamLabel({
  sender,
  receiver,
  denom,
  counterparty,
  className,
}: StreamLabelProps) {
  const { t } = useLingui()
  const key = `${sender}:${receiver}:${denom}`
  // Select the specific value, NOT the whole map — `?? {}` on the map would
  // synthesise a new object each selector invocation, which Zustand's default
  // equality (`Object.is`) treats as a state change, triggering an infinite
  // render loop (React error #185).
  const stored = useVaultStore((s) => s.vault?.streamLabels?.[key] ?? '')
  const setStreamLabel = useVaultStore((s) => s.setStreamLabel)

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(stored)
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  const startEdit = () => {
    setDraft(stored)
    setEditing(true)
  }
  const cancel = () => {
    setEditing(false)
    setDraft(stored)
  }
  const save = async () => {
    if (saving) return
    setSaving(true)
    try {
      await setStreamLabel(sender, receiver, denom, draft)
      setEditing(false)
    } catch (err) {
      console.error('[StreamLabel] save failed', err)
    } finally {
      setSaving(false)
    }
  }

  if (editing) {
    return (
      <span className={cn('flex items-center gap-1', className)}>
        <Input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void save()
            else if (e.key === 'Escape') cancel()
          }}
          maxLength={64}
          placeholder={t`Label this stream`}
          className="h-6 text-[11px] px-1.5 min-w-0 flex-1"
          aria-label={t`Stream label`}
        />
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          aria-label={t`Save label`}
          className="text-muted-foreground hover:text-success transition-colors"
        >
          <Check className="h-3 w-3" />
        </button>
        <button
          type="button"
          onClick={cancel}
          disabled={saving}
          aria-label={t`Cancel`}
          className="text-muted-foreground hover:text-destructive transition-colors"
        >
          <X className="h-3 w-3" />
        </button>
      </span>
    )
  }

  return (
    <span className={cn('flex items-center gap-1 min-w-0', className)}>
      {stored ? (
        <span className="text-[11px] font-medium truncate" title={counterparty}>
          {stored}
        </span>
      ) : (
        <span className="font-mono text-[11px] truncate" title={counterparty}>
          {counterparty}
        </span>
      )}
      <button
        type="button"
        onClick={startEdit}
        aria-label={stored ? t`Edit stream label` : t`Add stream label`}
        className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
      >
        <Pencil className="h-2.5 w-2.5" />
      </button>
    </span>
  )
}
