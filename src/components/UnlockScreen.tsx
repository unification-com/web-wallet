import { useState } from 'react'

import { useVaultStore } from '@/lib/vault'

export function UnlockScreen() {
  const unlock = useVaultStore((s) => s.unlock)
  const resetVault = useVaultStore((s) => s.resetVault)
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
    <main className="p-4 flex flex-col gap-3 max-w-md mx-auto">
      <h1 className="text-xl font-semibold">Unlock wallet</h1>
      <p className="text-sm text-gray-500">Enter your password to unlock the vault.</p>
      {/* eslint-disable-next-line @typescript-eslint/no-misused-promises */}
      <form onSubmit={onUnlock} className="flex flex-col gap-2 text-sm">
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          // eslint-disable-next-line jsx-a11y/no-autofocus -- intentional: cursor in password field on unlock-screen mount
          autoFocus
          className="border rounded px-2 py-1"
        />
        {error && <p className="text-xs text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={submitting || password.length === 0}
          className="bg-blue-600 text-white rounded py-1 text-sm hover:bg-blue-700 disabled:opacity-50"
        >
          {submitting ? 'Unlocking…' : 'Unlock'}
        </button>
      </form>

      <div className="border-t pt-3 mt-2">
        <details className="text-xs text-gray-500">
          <summary className="cursor-pointer">Forgot your password?</summary>
          <p className="mt-2">
            There&apos;s no password recovery — vaults are encrypted with PBKDF2 + AES-GCM. If
            you&apos;ve lost the password, the only path is to reset the wallet and re-import
            from your seed phrase or v1 keystore file. Resetting wipes the encrypted vault.
          </p>
          <button
            type="button"
            // eslint-disable-next-line @typescript-eslint/no-misused-promises
            onClick={async () => {
              if (confirm('Reset the wallet? This wipes the encrypted vault permanently.')) {
                await resetVault()
              }
            }}
            className="mt-2 text-red-600 underline"
          >
            Reset wallet
          </button>
        </details>
      </div>
    </main>
  )
}
