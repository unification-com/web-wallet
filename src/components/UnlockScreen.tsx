import { Trans, useLingui } from '@lingui/react/macro'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
    <main className="p-4 flex flex-col gap-4">
      <h1 className="text-xl font-semibold">
        <Trans>Unlock wallet</Trans>
      </h1>
      <Card>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm">
            <Trans>Enter your password</Trans>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-2 flex flex-col gap-3">
          {/* eslint-disable-next-line @typescript-eslint/no-misused-promises */}
          <form onSubmit={onUnlock} className="flex flex-col gap-3 text-sm">
            <div className="flex flex-col gap-1">
              <Label htmlFor="unlock-password">
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
            <Button type="submit" size="sm" disabled={submitting || password.length === 0}>
              {submitting ? <Trans>Unlocking…</Trans> : <Trans>Unlock</Trans>}
            </Button>
          </form>

          <div className="border-t pt-3">
            <details className="text-xs text-muted-foreground">
              <summary className="cursor-pointer">
                <Trans>Forgot your password?</Trans>
              </summary>
              <p className="mt-2">
                <Trans>
                  There&apos;s no password recovery — vaults are encrypted with PBKDF2 +
                  AES-GCM. If you&apos;ve lost the password, the only path is to reset the
                  wallet and re-import from your seed phrase or v1 keystore file. Resetting
                  wipes the encrypted vault.
                </Trans>
              </p>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="mt-2"
                // eslint-disable-next-line @typescript-eslint/no-misused-promises
                onClick={async () => {
                  if (confirm(t`Reset the wallet? This wipes the encrypted vault permanently.`)) {
                    await resetVault()
                  }
                }}
              >
                <Trans>Reset wallet</Trans>
              </Button>
            </details>
          </div>
        </CardContent>
      </Card>
    </main>
  )
}
