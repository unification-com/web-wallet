import { Eye, FileJson, KeyRound, Plus } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import { generateMnemonic, validateMnemonic } from '@/lib/vault/seeds'
import { type V1KeystoreJson } from '@/lib/vault/v1-keystore'

type Mode = null | 'generate' | 'import-seed' | 'import-v1'

/**
 * Add another wallet entry to an already-unlocked vault. Three flows:
 *
 *   1. Generate a fresh BIP39 seed (12 or 24 words) — adds via `addSeed`.
 *   2. Import an existing BIP39 phrase — adds via `addSeed`.
 *   3. Import a v1 `.json` keystore — adds via `importV1Keystore`. The file
 *      picker would close the MV3 popup (focus-loss trap), so in popup mode
 *      the v1 button opens a standalone tab + closes the popup; the user
 *      navigates manually to Settings → Add another in the new tab.
 *
 * VaultSetup handles the same three flows for the no-vault / no-active-signer
 * cases. This card is the equivalent path once the wallet already has a
 * signer (i.e. operator is hosting multiple seeds / keystores in one vault).
 */
export function AddSignerCard({ surface }: { surface: 'popup' | 'standalone' | 'web' }) {
  const addSeed = useVaultStore((s) => s.addSeed)
  const importV1Keystore = useVaultStore((s) => s.importV1Keystore)
  const setActiveSigner = useVaultStore((s) => s.setActiveSigner)

  const [mode, setMode] = useState<Mode>(null)

  const close = () => setMode(null)

  const openV1Import = () => {
    if (surface === 'popup' && typeof chrome !== 'undefined' && chrome.tabs?.create) {
      void chrome.tabs.create({ url: chrome.runtime.getURL('standalone.html') })
      window.close()
      return
    }
    setMode('import-v1')
  }

  return (
    <Card>
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-sm flex items-center gap-1">
          <Plus className="h-3.5 w-3.5" /> Add another
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-2 flex flex-col gap-2 text-xs">
        <p className="text-muted-foreground">
          Add a fresh seed, recover an existing one, or import a v1 `.json` keystore into
          this vault. All entries share the same password and auto-lock timer.
        </p>
        <div className="grid grid-cols-1 gap-2">
          <Button variant="outline" size="sm" onClick={() => setMode('generate')}>
            <Eye className="h-3.5 w-3.5" />
            Generate new seed
          </Button>
          <Button variant="outline" size="sm" onClick={() => setMode('import-seed')}>
            <KeyRound className="h-3.5 w-3.5" />
            Import existing seed
          </Button>
          <Button variant="outline" size="sm" onClick={openV1Import}>
            <FileJson className="h-3.5 w-3.5" />
            Import v1 keystore
            {surface === 'popup' && <span className="text-[10px] opacity-60">(opens tab)</span>}
          </Button>
        </div>
      </CardContent>

      <GenerateSeedDialog
        open={mode === 'generate'}
        onClose={close}
        addSeed={addSeed}
        setActiveSigner={setActiveSigner}
      />
      <ImportSeedDialog
        open={mode === 'import-seed'}
        onClose={close}
        addSeed={addSeed}
        setActiveSigner={setActiveSigner}
      />
      <ImportV1Dialog
        open={mode === 'import-v1'}
        onClose={close}
        importV1Keystore={importV1Keystore}
        setActiveSigner={setActiveSigner}
      />
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Generate new seed
// ---------------------------------------------------------------------------

function GenerateSeedDialog({
  open,
  onClose,
  addSeed,
  setActiveSigner,
}: {
  open: boolean
  onClose: () => void
  addSeed: ReturnType<typeof useVaultStore.getState>['addSeed']
  setActiveSigner: ReturnType<typeof useVaultStore.getState>['setActiveSigner']
}) {
  const [seedSize, setSeedSize] = useState<128 | 256>(128)
  const [mnemonic, setMnemonic] = useState('')
  const [acknowledged, setAcknowledged] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generate = () => {
    setMnemonic(generateMnemonic(seedSize))
    setError(null)
  }

  const reset = () => {
    setMnemonic('')
    setAcknowledged(false)
    setError(null)
    setSubmitting(false)
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const finish = async () => {
    setSubmitting(true)
    try {
      const seed = await addSeed(mnemonic)
      await setActiveSigner({ kind: 'vault-seed', seedId: seed.id, accountIndex: 0 })
      handleClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Generate new seed</DialogTitle>
          <DialogDescription>
            A fresh BIP39 mnemonic will be generated and saved as a new seed in this vault.
          </DialogDescription>
        </DialogHeader>

        {!mnemonic && (
          <div className="flex flex-col gap-2 text-xs">
            <fieldset className="flex flex-col gap-1">
              <legend className="font-medium text-sm">Seed phrase length</legend>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="add-seedSize"
                  checked={seedSize === 128}
                  onChange={() => setSeedSize(128)}
                />
                <span>12 words (standard)</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="add-seedSize"
                  checked={seedSize === 256}
                  onChange={() => setSeedSize(256)}
                />
                <span>24 words (stronger)</span>
              </label>
            </fieldset>
            <DialogFooter className="gap-2">
              <Button variant="outline" size="sm" onClick={handleClose}>
                Cancel
              </Button>
              <Button size="sm" onClick={generate}>
                Generate {seedSize === 128 ? '12' : '24'} words
              </Button>
            </DialogFooter>
          </div>
        )}

        {mnemonic && (
          <div className="flex flex-col gap-2 text-xs">
            <div className="rounded border border-destructive/30 bg-destructive/5 p-2 text-destructive">
              Write these words down somewhere safe. They are the only way to recover the
              funds in any account derived from this seed.
            </div>
            <ol className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono rounded border bg-muted p-3">
              {mnemonic.split(' ').map((word, i) => (
                <li key={`${i.toString()}-${word}`} className="flex gap-2">
                  <span className="text-muted-foreground w-6 text-right">{i + 1}.</span>
                  <span>{word}</span>
                </li>
              ))}
            </ol>
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)}
                className="mt-0.5"
              />
              <span>I&apos;ve written the seed phrase down somewhere safe.</span>
            </label>
            {error && <p className="text-destructive">{error}</p>}
            <DialogFooter className="gap-2">
              <Button variant="outline" size="sm" onClick={handleClose} disabled={submitting}>
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={!acknowledged || submitting}
                // eslint-disable-next-line @typescript-eslint/no-misused-promises
                onClick={finish}
              >
                {submitting ? 'Saving…' : 'Save seed'}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Import existing seed
// ---------------------------------------------------------------------------

function ImportSeedDialog({
  open,
  onClose,
  addSeed,
  setActiveSigner,
}: {
  open: boolean
  onClose: () => void
  addSeed: ReturnType<typeof useVaultStore.getState>['addSeed']
  setActiveSigner: ReturnType<typeof useVaultStore.getState>['setActiveSigner']
}) {
  const [phrase, setPhrase] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reset = () => {
    setPhrase('')
    setError(null)
    setSubmitting(false)
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const finish = async () => {
    setError(null)
    const normalised = phrase.trim().replace(/\s+/g, ' ')
    if (!validateMnemonic(normalised)) {
      setError('not a valid BIP39 mnemonic (check wordlist + checksum)')
      return
    }
    setSubmitting(true)
    try {
      const seed = await addSeed(normalised)
      await setActiveSigner({ kind: 'vault-seed', seedId: seed.id, accountIndex: 0 })
      handleClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Import existing seed</DialogTitle>
          <DialogDescription>
            Paste a 12 or 24 word BIP39 phrase. Whitespace and case are normalised.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2 text-xs">
          <Label htmlFor="add-seed-phrase">Mnemonic</Label>
          <textarea
            id="add-seed-phrase"
            value={phrase}
            onChange={(e) => setPhrase(e.target.value)}
            rows={3}
            placeholder="word1 word2 word3 …"
            className="border rounded px-2 py-1 font-mono text-xs bg-background"
          />
          {error && <p className="text-destructive">{error}</p>}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={submitting || phrase.trim().length === 0}
            // eslint-disable-next-line @typescript-eslint/no-misused-promises
            onClick={finish}
          >
            {submitting ? 'Importing…' : 'Import seed'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Import v1 keystore
// ---------------------------------------------------------------------------

function ImportV1Dialog({
  open,
  onClose,
  importV1Keystore,
  setActiveSigner,
}: {
  open: boolean
  onClose: () => void
  importV1Keystore: ReturnType<typeof useVaultStore.getState>['importV1Keystore']
  setActiveSigner: ReturnType<typeof useVaultStore.getState>['setActiveSigner']
}) {
  const [json, setJson] = useState<V1KeystoreJson | null>(null)
  const [fileName, setFileName] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reset = () => {
    setJson(null)
    setFileName('')
    setPassword('')
    setError(null)
    setSubmitting(false)
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const onFileChosen = async (file: File) => {
    setError(null)
    try {
      const text = await file.text()
      const parsed = JSON.parse(text) as V1KeystoreJson
      if (parsed.version !== 1 || typeof parsed.crypto !== 'object') {
        setError('not a v1 keystore file (missing version:1 or crypto block)')
        return
      }
      setJson(parsed)
      setFileName(file.name)
    } catch (err) {
      setError(err instanceof Error ? `failed to read file: ${err.message}` : String(err))
    }
  }

  const finish = async () => {
    if (!json) {
      setError('no keystore file selected')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const entry = await importV1Keystore(json, password)
      await setActiveSigner({ kind: 'vault-imported', id: entry.id })
      handleClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Import v1 keystore</DialogTitle>
          <DialogDescription>
            Select a v1 `.json` keystore file and enter its password. Decryption happens
            locally; nothing leaves your browser.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2 text-xs">
          <div className="flex flex-col gap-1">
            <Label htmlFor="add-v1-file">v1 keystore file</Label>
            <Input
              id="add-v1-file"
              type="file"
              accept=".json,application/json"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void onFileChosen(file)
              }}
            />
            {fileName && <span className="text-muted-foreground">Loaded: {fileName}</span>}
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="add-v1-password">v1 keystore password</Label>
            <Input
              id="add-v1-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && <p className="text-destructive break-words">{error}</p>}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={submitting || !json || password.length === 0}
            // eslint-disable-next-line @typescript-eslint/no-misused-promises
            onClick={finish}
          >
            {submitting ? 'Importing…' : 'Import keystore'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
