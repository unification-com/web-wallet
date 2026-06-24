import { Trans, useLingui } from '@lingui/react/macro'
import { Lock } from 'lucide-react'
import { useState } from 'react'

import { BrandMark } from '@/components/ui/BrandMark'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useVaultStore } from '@/lib/vault'

export function UnlockScreen() {
  const unlock = useVaultStore((s) => s.unlock)
  const resetVault = useVaultStore((s) => s.resetVault)
  const { t } = useLingui()
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const onUnlock = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await unlock(password)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen p-4 flex flex-col items-center justify-center gap-6 max-w-md mx-auto">
      {/* Brand + status */}
      <div className="flex flex-col items-center gap-3">
        <BrandMark className="h-12 w-12" />
        <div className="text-center flex flex-col gap-1">
          <h1 className="text-xl font-semibold tracking-tight [.theme-mainframe_&]:font-mono [.theme-mainframe_&]:uppercase [.theme-mainframe_&]:tracking-[0.06em]">
            <Trans>Unification Wallet</Trans>
          </h1>
          <p className="text-[10px] font-mono uppercase tracking-[0.10em] text-muted-foreground inline-flex items-center justify-center gap-1.5">
            <Lock className="h-3 w-3" />
            <Trans>Vault locked</Trans>
          </p>
        </div>
      </div>

      {/* Unlock form */}
      {/* eslint-disable-next-line @typescript-eslint/no-misused-promises */}
      <form onSubmit={onUnlock} className="w-full flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="unlock-password" className="text-xs text-muted-foreground">
            <Trans>Password</Trans>
          </Label>
          <Input
            id="unlock-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t`Password`}
            // eslint-disable-next-line jsx-a11y/no-autofocus -- intentional: cursor in password field on unlock-screen mount
            autoFocus
          />
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <Button type="submit" variant="brand" size="lg" disabled={submitting || password.length === 0} className="w-full">
          {submitting ? <Trans>Unlocking…</Trans> : <Trans>Unlock</Trans>}
        </Button>
      </form>

      {/* Reset escape hatch — quiet by default, expandable */}
      <details className="w-full text-xs text-muted-foreground group">
        <summary className="cursor-pointer text-center text-muted-foreground hover:text-foreground transition-colors list-none [&::-webkit-details-marker]:hidden">
          <Trans>Forgot your password?</Trans>
        </summary>
        <div className="mt-3 p-3 rounded border border-border bg-card flex flex-col gap-2.5">
          <p className="leading-relaxed">
            <Trans>
              There&apos;s no password recovery — vaults are encrypted with PBKDF2 +
              AES-GCM. If you&apos;ve lost the password, the only path is to reset the
              wallet and re-import from your seed phrase or v1 keystore file. Resetting
              wipes the encrypted vault.
            </Trans>
          </p>
          <Button
            type="button"
            variant="destructive-outline"
            size="sm"
            // eslint-disable-next-line @typescript-eslint/no-misused-promises
            onClick={async () => {
              if (confirm(t`Reset the wallet? This wipes the encrypted vault permanently.`)) {
                await resetVault()
              }
            }}
          >
            <Trans>Reset wallet</Trans>
          </Button>
        </div>
      </details>
    </main>
  )
}
