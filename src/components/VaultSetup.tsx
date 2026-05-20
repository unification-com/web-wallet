import { useState } from 'react'

import { useVaultStore } from '@/lib/vault'
import { generateMnemonic } from '@/lib/vault/seeds'

type Step = 'password' | 'show-seed' | 'confirm-seed'

export function VaultSetup() {
  const createVault = useVaultStore((s) => s.createVault)
  const addSeed = useVaultStore((s) => s.addSeed)
  const setActiveSigner = useVaultStore((s) => s.setActiveSigner)

  const [step, setStep] = useState<Step>('password')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [mnemonic, setMnemonic] = useState('')
  const [seedSize, setSeedSize] = useState<128 | 256>(128)
  const [acknowledged, setAcknowledged] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const onSetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (password.length < 8) {
      setError('password must be at least 8 characters')
      return
    }
    if (password !== passwordConfirm) {
      setError('passwords do not match')
      return
    }
    setSubmitting(true)
    try {
      await createVault(password)
      const m = generateMnemonic(seedSize)
      setMnemonic(m)
      setStep('show-seed')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSubmitting(false)
    }
  }

  const onFinish = async () => {
    setSubmitting(true)
    setError(null)
    try {
      const seed = await addSeed(mnemonic, 'Seed 1')
      // Make this seed's first account the active signer so the rest of the UI
      // has something to work with immediately.
      await setActiveSigner({
        kind: 'vault-seed',
        seedId: seed.id,
        accountIndex: 0,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="p-4 flex flex-col gap-3 max-w-md mx-auto">
      <h1 className="text-xl font-semibold">Create wallet</h1>

      {step === 'password' && (
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        <form onSubmit={onSetPassword} className="flex flex-col gap-2 text-sm">
          <p className="text-gray-500">
            Set a password to encrypt your vault. PBKDF2 + AES-GCM with random salt + IV.
            There&apos;s no recovery — write it down somewhere safe.
          </p>
          <label className="flex flex-col gap-1">
            <span className="text-gray-500">Password (≥ 8 chars)</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              // eslint-disable-next-line jsx-a11y/no-autofocus -- intentional: cursor in password field on setup-screen mount
              autoFocus
              className="border rounded px-2 py-1"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-gray-500">Confirm password</span>
            <input
              type="password"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              className="border rounded px-2 py-1"
            />
          </label>
          <fieldset className="flex flex-col gap-1">
            <legend className="text-gray-500">Seed phrase length</legend>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="seedSize"
                checked={seedSize === 128}
                onChange={() => setSeedSize(128)}
              />
              <span>12 words (standard)</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="seedSize"
                checked={seedSize === 256}
                onChange={() => setSeedSize(256)}
              />
              <span>24 words (stronger)</span>
            </label>
          </fieldset>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="bg-blue-600 text-white rounded py-1 text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? 'Creating…' : 'Continue'}
          </button>
        </form>
      )}

      {step === 'show-seed' && (
        <div className="flex flex-col gap-3 text-sm">
          <p className="text-gray-500">
            Write down these {seedSize === 128 ? '12' : '24'} words in order. They&apos;re the
            only way to recover your wallet if you lose your password or device.
          </p>
          <div className="border rounded p-3 bg-gray-50">
            <ol className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs font-mono">
              {mnemonic.split(' ').map((word, i) => (
                <li key={`${i.toString()}-${word}`} className="flex gap-2">
                  <span className="text-gray-400 w-6 text-right">{i + 1}.</span>
                  <span>{word}</span>
                </li>
              ))}
            </ol>
          </div>
          <label className="flex items-start gap-2 text-xs">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              className="mt-0.5"
            />
            <span>I&apos;ve written the seed phrase down somewhere safe.</span>
          </label>
          <button
            type="button"
            disabled={!acknowledged || submitting}
            // eslint-disable-next-line @typescript-eslint/no-misused-promises
            onClick={onFinish}
            className="bg-green-600 text-white rounded py-1 text-sm hover:bg-green-700 disabled:opacity-50"
          >
            {submitting ? 'Finishing…' : 'Finish setup'}
          </button>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
      )}
    </main>
  )
}
