import { useEffect, useState } from 'react'

import { useVaultStore } from '@/lib/vault'
import { generateMnemonic, validateMnemonic } from '@/lib/vault/seeds'
import { type V1KeystoreJson } from '@/lib/vault/v1-keystore'

type Mode = 'generate' | 'import-seed' | 'import-v1'
type Step = 'password' | 'choose' | 'generate-show' | 'import-seed-paste' | 'import-v1-pick'
type Surface = 'popup' | 'standalone' | 'web'

const HASH_IMPORT_V1 = '#import-v1'

export function VaultSetup({ surface }: { surface: Surface }) {
  const status = useVaultStore((s) => s.status)
  const createVault = useVaultStore((s) => s.createVault)
  const addSeed = useVaultStore((s) => s.addSeed)
  const importV1Keystore = useVaultStore((s) => s.importV1Keystore)
  const setActiveSigner = useVaultStore((s) => s.setActiveSigner)

  // If the vault is already unlocked we've come back to setup mid-flow
  // (just-created, or reloaded after partial setup) — skip the password step.
  const [step, setStep] = useState<Step>(status === 'no-vault' ? 'password' : 'choose')

  // Auto-route to the v1 import step when the standalone tab is opened with
  // the `#import-v1` hash from the popup's import-v1 button. Avoids the MV3
  // popup focus-loss closure that kills the file picker mid-flow. Clears the
  // hash once consumed so a reload doesn't replay the route.
  useEffect(() => {
    if (window.location.hash !== HASH_IMPORT_V1) return
    if (step === 'choose') {
      setStep('import-v1-pick')
      history.replaceState(null, '', window.location.pathname + window.location.search)
    }
  }, [step])
  const [, setMode] = useState<Mode | null>(null)
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Generate-flow state
  const [seedSize, setSeedSize] = useState<128 | 256>(128)
  const [mnemonic, setMnemonic] = useState('')
  const [acknowledged, setAcknowledged] = useState(false)

  // Import-seed state
  const [importedMnemonic, setImportedMnemonic] = useState('')

  // Import-v1 state
  const [v1Json, setV1Json] = useState<V1KeystoreJson | null>(null)
  const [v1JsonFileName, setV1JsonFileName] = useState('')
  const [v1Password, setV1Password] = useState('')

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
      setStep('choose')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSubmitting(false)
    }
  }

  const pickGenerate = () => {
    setMode('generate')
    setMnemonic(generateMnemonic(seedSize))
    setStep('generate-show')
  }

  const pickImportSeed = () => {
    setMode('import-seed')
    setStep('import-seed-paste')
  }

  const pickImportV1 = () => {
    // MV3 popup workaround — the OS file picker steals focus and closes the
    // popup mid-flow. Standalone tab has no such restriction. Reopen the
    // wallet in a tab with a hash hint so VaultSetup auto-advances to the
    // import step after the user unlocks (or directly if mid-setup).
    if (surface === 'popup' && typeof chrome !== 'undefined' && chrome.tabs?.create) {
      void chrome.tabs.create({
        url: chrome.runtime.getURL(`standalone.html${HASH_IMPORT_V1}`),
      })
      window.close()
      return
    }
    setMode('import-v1')
    setStep('import-v1-pick')
  }

  const finishGenerate = async () => {
    setSubmitting(true)
    setError(null)
    try {
      const seed = await addSeed(mnemonic, 'Seed 1')
      await setActiveSigner({ kind: 'vault-seed', seedId: seed.id, accountIndex: 0 })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSubmitting(false)
    }
  }

  const finishImportSeed = async () => {
    setError(null)
    const normalised = importedMnemonic.trim().replace(/\s+/g, ' ')
    if (!validateMnemonic(normalised)) {
      setError('not a valid BIP39 mnemonic (check wordlist + checksum)')
      return
    }
    setSubmitting(true)
    try {
      const seed = await addSeed(normalised, 'Seed 1')
      await setActiveSigner({ kind: 'vault-seed', seedId: seed.id, accountIndex: 0 })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSubmitting(false)
    }
  }

  const onV1FileChosen = async (file: File) => {
    setError(null)
    try {
      const text = await file.text()
      const parsed = JSON.parse(text) as V1KeystoreJson
      // Minimal sniff — full validation happens in decryptV1Keystore.
      if (parsed.version !== 1 || typeof parsed.crypto !== 'object') {
        setError('not a v1 keystore file (missing version:1 or crypto block)')
        return
      }
      setV1Json(parsed)
      setV1JsonFileName(file.name)
    } catch (err) {
      setError(err instanceof Error ? `failed to read file: ${err.message}` : String(err))
    }
  }

  const finishImportV1 = async () => {
    if (!v1Json) {
      setError('no keystore file selected')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const entry = await importV1Keystore(v1Json, v1Password, 'Imported (v1 JSON)')
      await setActiveSigner({ kind: 'vault-imported', id: entry.id })
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
            Set a password to encrypt your vault (PBKDF2 + AES-GCM with random salt + IV).
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

      {step === 'choose' && (
        <div className="flex flex-col gap-3 text-sm">
          <p className="text-gray-500">How would you like to start? Pick one to continue.</p>

          <div className="border rounded p-3 flex flex-col gap-2 bg-gray-50">
            <fieldset className="flex flex-col gap-1 text-xs">
              <legend className="font-medium text-sm text-gray-900 mb-1">
                Generate a new seed
              </legend>
              <p className="text-gray-500">Create a fresh BIP39 mnemonic.</p>
              <label className="flex items-center gap-2 mt-1">
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
            <button
              type="button"
              onClick={pickGenerate}
              className="bg-blue-600 text-white rounded py-1 px-3 text-sm hover:bg-blue-700"
            >
              Generate {seedSize === 128 ? '12' : '24'}-word seed →
            </button>
          </div>

          <button
            type="button"
            onClick={pickImportSeed}
            className="border rounded p-3 text-left hover:bg-gray-50 flex items-center justify-between gap-2"
          >
            <span>
              <span className="block font-medium">Import an existing seed</span>
              <span className="block text-xs text-gray-500">
                Paste a 12 or 24 word BIP39 phrase.
              </span>
            </span>
            <span aria-hidden className="text-gray-400">→</span>
          </button>

          <button
            type="button"
            onClick={pickImportV1}
            className="border rounded p-3 text-left hover:bg-gray-50 flex items-center justify-between gap-2"
          >
            <span>
              <span className="block font-medium">Import a v1 wallet file</span>
              <span className="block text-xs text-gray-500">
                Migrate a `.json` keystore from the legacy v1 web-wallet. Single-key
                only — v1 didn&apos;t store a mnemonic.
              </span>
            </span>
            <span aria-hidden className="text-gray-400">→</span>
          </button>
        </div>
      )}

      {step === 'generate-show' && (
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
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStep('choose')}
              className="border rounded py-1 px-3 text-sm hover:bg-gray-50"
            >
              Back
            </button>
            <button
              type="button"
              disabled={!acknowledged || submitting}
              // eslint-disable-next-line @typescript-eslint/no-misused-promises
              onClick={finishGenerate}
              className="bg-green-600 text-white rounded py-1 px-3 text-sm hover:bg-green-700 disabled:opacity-50"
            >
              {submitting ? 'Finishing…' : 'Finish setup'}
            </button>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
      )}

      {step === 'import-seed-paste' && (
        <div className="flex flex-col gap-3 text-sm">
          <p className="text-gray-500">
            Paste your existing 12 or 24 word BIP39 phrase. Words are space-separated; case
            and extra whitespace are normalised automatically.
          </p>
          <textarea
            value={importedMnemonic}
            onChange={(e) => setImportedMnemonic(e.target.value)}
            rows={3}
            className="border rounded px-2 py-1 font-mono text-xs"
            placeholder="word1 word2 word3 …"
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStep('choose')}
              className="border rounded py-1 px-3 text-sm hover:bg-gray-50"
            >
              Back
            </button>
            <button
              type="button"
              disabled={submitting || importedMnemonic.trim().length === 0}
              // eslint-disable-next-line @typescript-eslint/no-misused-promises
              onClick={finishImportSeed}
              className="bg-green-600 text-white rounded py-1 px-3 text-sm hover:bg-green-700 disabled:opacity-50"
            >
              {submitting ? 'Importing…' : 'Import seed'}
            </button>
          </div>
        </div>
      )}

      {step === 'import-v1-pick' && (
        <div className="flex flex-col gap-3 text-sm">
          <p className="text-gray-500">
            Select your v1 `.json` keystore file and enter its password. The file will be
            decrypted locally — nothing leaves your browser.
          </p>
          <label className="flex flex-col gap-1">
            <span className="text-gray-500">v1 keystore file</span>
            <input
              type="file"
              accept=".json,application/json"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void onV1FileChosen(file)
              }}
              className="text-xs"
            />
            {v1JsonFileName && (
              <span className="text-xs text-gray-500">Loaded: {v1JsonFileName}</span>
            )}
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-gray-500">v1 keystore password</span>
            <input
              type="password"
              value={v1Password}
              onChange={(e) => setV1Password(e.target.value)}
              className="border rounded px-2 py-1"
            />
          </label>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStep('choose')}
              className="border rounded py-1 px-3 text-sm hover:bg-gray-50"
            >
              Back
            </button>
            <button
              type="button"
              disabled={submitting || !v1Json || v1Password.length === 0}
              // eslint-disable-next-line @typescript-eslint/no-misused-promises
              onClick={finishImportV1}
              className="bg-green-600 text-white rounded py-1 px-3 text-sm hover:bg-green-700 disabled:opacity-50"
            >
              {submitting ? 'Importing…' : 'Import v1 keystore'}
            </button>
          </div>
        </div>
      )}
    </main>
  )
}
