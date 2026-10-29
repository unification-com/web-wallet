import { Trans, useLingui } from '@lingui/react/macro'
import { Check } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useVaultStore } from '@/lib/vault'

export interface RevealedSecret {
  /** Plain-text value passed to `navigator.clipboard.writeText` on Copy. */
  copyText: string
  /** Rich React node shown in the dialog body (numbered grid, monospace block, …). */
  display: ReactNode
}

interface RevealSecretDialogProps {
  open: boolean
  onClose: () => void
  title: ReactNode
  /** Shown in the description slot before password verification. */
  preRevealDescription: ReactNode
  /** Shown in the description slot after password verification (above the secret). */
  postRevealDescription: ReactNode
  /** Warning banner content shown above the secret display. */
  warningContent: ReactNode
  /**
   * Called after the password verifies, on the same tick. Returns the secret
   * to display + copy. Async so seed-derived private keys can compute via
   * `deriveAccount` without blocking the verify step. Throws bubble up as
   * the error banner.
   */
  resolveSecret: () => Promise<RevealedSecret>
  /** Optional label override for the Copy button (defaults to "Copy"). */
  copyLabel?: ReactNode
}

/**
 * Shared password-gated secret-reveal dialog. Used for revealing seed
 * phrases (numbered word grid) AND per-account private keys (monospace
 * hex block) — the dialog handles the password state machine, post-reveal
 * warning, copy-to-clipboard, and reset-on-close hygiene; callers provide
 * the title, description copy, and the async `resolveSecret` callback that
 * produces the display node + copy text.
 *
 * Security hygiene: every piece of secret state is wiped on close. The
 * password + secret never survive past the dialog instance.
 */
export function RevealSecretDialog({
  open,
  onClose,
  title,
  preRevealDescription,
  postRevealDescription,
  warningContent,
  resolveSecret,
  copyLabel,
}: RevealSecretDialogProps) {
  const verifyPassword = useVaultStore((s) => s.verifyPassword)
  const { t } = useLingui()
  const [password, setPassword] = useState('')
  const [secret, setSecret] = useState<RevealedSecret | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)

  // Reset on close — defence-in-depth so neither the password nor the secret
  // lingers in React state after the user dismisses the dialog.
  useEffect(() => {
    if (!open) {
      setPassword('')
      setSecret(null)
      setError(null)
      setBusy(false)
      setCopied(false)
    }
  }, [open])

  const onVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!verifyPassword(password)) {
      setError(t`wrong password`)
      return
    }
    setError(null)
    setBusy(true)
    try {
      const resolved = await resolveSecret()
      setSecret(resolved)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const onCopy = async () => {
    if (!secret) return
    try {
      await navigator.clipboard.writeText(secret.copyText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('[RevealSecretDialog] clipboard write failed', err)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {secret ? postRevealDescription : preRevealDescription}
          </DialogDescription>
        </DialogHeader>

        {!secret && (
          // eslint-disable-next-line @typescript-eslint/no-misused-promises
          <form onSubmit={onVerify} className="flex flex-col gap-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="reveal-secret-password">
                <Trans>Password</Trans>
              </Label>
              <Input
                id="reveal-secret-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={busy}
                // eslint-disable-next-line jsx-a11y/no-autofocus -- intentional: focus password field on dialog open
                autoFocus
              />
              {error && <p className="text-xs text-destructive">{error}</p>}
            </div>
            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={onClose}
              >
                <Trans>Cancel</Trans>
              </Button>
              <Button type="submit" size="sm" disabled={busy || password.length === 0}>
                {busy ? <Trans>Loading…</Trans> : <Trans>Reveal</Trans>}
              </Button>
            </DialogFooter>
          </form>
        )}

        {secret && (
          <div className="flex flex-col gap-2">
            <div className="rounded border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
              {warningContent}
            </div>
            {secret.display}
            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                // eslint-disable-next-line @typescript-eslint/no-misused-promises
                onClick={onCopy}
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    <Trans>Copied</Trans>
                  </>
                ) : (
                  (copyLabel ?? <Trans>Copy</Trans>)
                )}
              </Button>
              <Button type="button" size="sm" onClick={onClose}>
                <Trans>Done</Trans>
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
