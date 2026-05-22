import { Trans, useLingui } from '@lingui/react/macro'
import { ArrowRight, Check, Copy, Download, FileJson, KeyRound, RefreshCw, Sparkles, TriangleAlert } from 'lucide-react'
import { useEffect, useState } from 'react'

import { BrandMark } from '@/components/ui/BrandMark'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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

  const { t } = useLingui()
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
      setError(t`password must be at least 8 characters`)
      return
    }
    if (password !== passwordConfirm) {
      setError(t`passwords do not match`)
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
    if (surface === 'popup' && typeof chrome !== 'undefined' && chrome.tabs?.create) {
      void chrome.tabs.create({ url: chrome.runtime.getURL(`standalone.html${HASH_IMPORT_V1}`) })
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
      setError(t`not a valid BIP39 mnemonic (check wordlist + checksum)`)
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
      if (parsed.version !== 1 || typeof parsed.crypto !== 'object') {
        setError(t`not a v1 keystore file (missing version:1 or crypto block)`)
        return
      }
      setV1Json(parsed)
      setV1JsonFileName(file.name)
    } catch (err) {
      setError(err instanceof Error ? t`failed to read file: ${err.message}` : String(err))
    }
  }

  const finishImportV1 = async () => {
    if (!v1Json) {
      setError(t`no keystore file selected`)
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

  // Map step → breadcrumb label so the breadcrumb tells the user where
  // they are without duplicating the H1 underneath.
  const stepNum = step === 'password' ? 1 : step === 'choose' ? 2 : 3
  const stepLabel =
    step === 'password' ? t`Encrypt your vault`
    : step === 'choose' ? t`Pick a start`
    : step === 'generate-show' ? t`Save your seed`
    : step === 'import-seed-paste' ? t`Paste your phrase`
    : t`Migrate from v1`

  return (
    <main className="p-4 flex flex-col gap-4 max-w-md mx-auto">
      <div className="flex items-center gap-3">
        <BrandMark className="h-8 w-8" />
        <div className="flex flex-col leading-tight">
          <h1 className="text-lg font-semibold tracking-tight [.theme-mainframe_&]:font-mono [.theme-mainframe_&]:uppercase [.theme-mainframe_&]:tracking-[0.06em]">
            <Trans>Create wallet</Trans>
          </h1>
          <StepBreadcrumb step={stepNum} total={3} label={stepLabel} />
        </div>
      </div>

      {step === 'password' && (
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        <form onSubmit={onSetPassword} className="flex flex-col gap-3 text-sm">
          <p className="text-xs text-muted-foreground leading-relaxed">
            <Trans>
              Set a password to encrypt your vault (PBKDF2 + AES-GCM with random salt + IV).
              There&apos;s no recovery — write it down somewhere safe.
            </Trans>
          </p>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="vs-pw" className="text-xs text-muted-foreground">
              <Trans>Password (≥ 8 chars)</Trans>
            </Label>
            <Input
              id="vs-pw"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              // eslint-disable-next-line jsx-a11y/no-autofocus -- intentional: cursor in password field on setup-screen mount
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="vs-pw2" className="text-xs text-muted-foreground">
              <Trans>Confirm password</Trans>
            </Label>
            <Input
              id="vs-pw2"
              type="password"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
            />
          </div>
          <StrengthMeter password={password} />
          {error && <ErrorLine text={error} />}
          <Button type="submit" variant="brand" disabled={submitting} size="lg" className="mt-1">
            {submitting ? <Trans>Creating…</Trans> : <Trans>Continue</Trans>}
            {!submitting && <ArrowRight className="h-4 w-4" />}
          </Button>
        </form>
      )}

      {step === 'choose' && (
        <div className="flex flex-col gap-3 text-sm">
          <p className="text-xs text-muted-foreground leading-relaxed">
            <Trans>How would you like to start? Pick one to continue.</Trans>
          </p>

          {/* Generate — primary path, expanded */}
          <Card className="border-primary/50 bg-primary/[0.06]">
            <CardContent className="p-3 flex flex-col gap-2">
              <div className="flex items-center gap-2.5">
                <PathGlyph icon={<Sparkles className="h-4 w-4" />} />
                <div className="flex flex-col flex-1 min-w-0">
                  <span className="font-medium text-sm">
                    <Trans>Generate a new seed</Trans>
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    <Trans>Create a fresh BIP39 mnemonic.</Trans>
                  </span>
                </div>
              </div>
              <fieldset className="flex gap-3 text-xs pt-2 pl-9 border-t border-border/60">
                <legend className="sr-only">
                  <Trans>Seed strength</Trans>
                </legend>
                <SeedSizeRadio active={seedSize === 128} onClick={() => setSeedSize(128)} label={t`12 words`} sub={t`standard`} />
                <SeedSizeRadio active={seedSize === 256} onClick={() => setSeedSize(256)} label={t`24 words`} sub={t`stronger`} />
              </fieldset>
              <Button type="button" variant="brand" onClick={pickGenerate} className="mt-1">
                <Trans>Generate {seedSize === 128 ? '12' : '24'}-word seed</Trans>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>

          <button
            type="button"
            onClick={pickImportSeed}
            className="text-left rounded border border-border bg-card hover:bg-secondary/50 transition-colors p-3 flex items-center gap-2.5"
          >
            <PathGlyph icon={<KeyRound className="h-4 w-4" />} />
            <span className="flex flex-col flex-1 min-w-0">
              <span className="font-medium text-sm">
                <Trans>Import an existing seed</Trans>
              </span>
              <span className="text-[11px] text-muted-foreground">
                <Trans>Paste a 12 or 24 word BIP39 phrase.</Trans>
              </span>
            </span>
            <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
          </button>

          <button
            type="button"
            onClick={pickImportV1}
            className="text-left rounded border border-border bg-card hover:bg-secondary/50 transition-colors p-3 flex items-center gap-2.5"
          >
            <PathGlyph icon={<FileJson className="h-4 w-4" />} />
            <span className="flex flex-col flex-1 min-w-0">
              <span className="font-medium text-sm">
                <Trans>Import a v1 wallet file</Trans>
              </span>
              <span className="text-[11px] text-muted-foreground">
                <Trans>
                  Migrate a `.json` keystore from the legacy v1 web-wallet. Single-key
                  only — v1 didn&apos;t store a mnemonic.
                </Trans>
              </span>
            </span>
            <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
          </button>
        </div>
      )}

      {step === 'generate-show' && (
        <div className="flex flex-col gap-3 text-sm">
          <p className="text-xs text-muted-foreground leading-relaxed">
            <Trans>
              Write down these {seedSize === 128 ? '12' : '24'} words in order.
              They&apos;re the only way to recover your wallet if you lose your password
              or device.
            </Trans>
          </p>

          <Card inset>
            <CardContent className="p-3">
              <ol className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                {mnemonic.split(' ').map((word, i) => (
                  <li
                    key={`${i.toString()}-${word}`}
                    className="flex items-baseline gap-2 px-2 py-1 rounded bg-card border border-border/60"
                  >
                    <span className="text-[10px] font-mono text-muted-foreground w-5 text-right tabular-nums">
                      {(i + 1).toString().padStart(2, '0')}
                    </span>
                    <span className="text-xs font-mono">{word}</span>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>

          <div className="flex gap-2 text-xs">
            <Button type="button" variant="outline" size="sm" className="flex-1">
              <Copy className="h-3.5 w-3.5" /> <Trans>Copy</Trans>
            </Button>
            <Button type="button" variant="outline" size="sm" className="flex-1">
              <Download className="h-3.5 w-3.5" /> <Trans>Download</Trans>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => setMnemonic(generateMnemonic(seedSize))}
            >
              <RefreshCw className="h-3.5 w-3.5" /> <Trans>Regenerate</Trans>
            </Button>
          </div>

          <div className="flex items-start gap-2 p-2.5 rounded border border-destructive/30 bg-destructive/10 text-xs">
            <TriangleAlert className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
            <span>
              <Trans>
                Never share. Never type into a website. Unification will never ask for it.
              </Trans>
            </span>
          </div>

          {/* eslint-disable-next-line jsx-a11y/label-has-associated-control -- nested <input> IS the associated control + <Trans> wraps accessible text; lint can't see through the macro */}
          <label className="flex items-start gap-2 text-xs cursor-pointer select-none">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              className="mt-0.5 accent-primary"
            />
            <span>
              <Trans>I&apos;ve written the seed phrase down somewhere safe.</Trans>
            </span>
          </label>

          {error && <ErrorLine text={error} />}

          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={() => setStep('choose')} className="flex-1">
              <Trans>Back</Trans>
            </Button>
            <Button
              type="button"
              variant="brand"
              disabled={!acknowledged || submitting}
              // eslint-disable-next-line @typescript-eslint/no-misused-promises
              onClick={finishGenerate}
              className="flex-[2]"
            >
              {submitting ? <Trans>Finishing…</Trans> : <Trans>Finish setup</Trans>}
              {!submitting && <Check className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      )}

      {step === 'import-seed-paste' && (
        <div className="flex flex-col gap-3 text-sm">
          <p className="text-xs text-muted-foreground leading-relaxed">
            <Trans>
              Paste your existing 12 or 24 word BIP39 phrase. Words are space-separated;
              case and extra whitespace are normalised automatically.
            </Trans>
          </p>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="vs-imp" className="text-xs text-muted-foreground">
              <Trans>Seed phrase</Trans>
            </Label>
            <textarea
              id="vs-imp"
              value={importedMnemonic}
              onChange={(e) => setImportedMnemonic(e.target.value)}
              rows={3}
              className="rounded border border-input bg-surface-sunk px-3 py-2 text-xs font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
              placeholder={t`word1 word2 word3 …`}
            />
            <WordCountStrip phrase={importedMnemonic} />
          </div>
          {error && <ErrorLine text={error} />}
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={() => setStep('choose')} className="flex-1">
              <Trans>Back</Trans>
            </Button>
            <Button
              type="button"
              variant="brand"
              disabled={submitting || importedMnemonic.trim().length === 0}
              // eslint-disable-next-line @typescript-eslint/no-misused-promises
              onClick={finishImportSeed}
              className="flex-[2]"
            >
              {submitting ? <Trans>Importing…</Trans> : <Trans>Import seed</Trans>}
            </Button>
          </div>
        </div>
      )}

      {step === 'import-v1-pick' && (
        <div className="flex flex-col gap-3 text-sm">
          <p className="text-xs text-muted-foreground leading-relaxed">
            <Trans>
              Select your v1 `.json` keystore file and enter its password. The file will be
              decrypted locally — nothing leaves your browser.
            </Trans>
          </p>

          <Card inset>
            <CardContent className="p-3 flex items-center gap-3">
              <FileJson className="h-6 w-6 text-primary shrink-0" />
              <div className="flex flex-col flex-1 min-w-0">
                <span className="text-xs font-medium truncate">
                  {v1JsonFileName || <span className="text-muted-foreground"><Trans>No file selected</Trans></span>}
                </span>
                <label className="text-[11px] text-primary cursor-pointer hover:underline">
                  <Trans>Choose keystore file…</Trans>
                  <input
                    type="file"
                    accept=".json,application/json"
                    className="sr-only"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) void onV1FileChosen(file)
                    }}
                  />
                </label>
              </div>
              {v1Json && (
                <span className="text-[10px] px-1.5 py-0.5 rounded uppercase tracking-[0.08em] font-mono font-semibold bg-success/12 text-success border border-success/30">
                  <Trans>v1 ok</Trans>
                </span>
              )}
            </CardContent>
          </Card>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="vs-v1pw" className="text-xs text-muted-foreground">
              <Trans>v1 keystore password</Trans>
            </Label>
            <Input
              id="vs-v1pw"
              type="password"
              value={v1Password}
              onChange={(e) => setV1Password(e.target.value)}
            />
          </div>

          {error && <ErrorLine text={error} />}

          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={() => setStep('choose')} className="flex-1">
              <Trans>Back</Trans>
            </Button>
            <Button
              type="button"
              variant="brand"
              disabled={submitting || !v1Json || v1Password.length === 0}
              // eslint-disable-next-line @typescript-eslint/no-misused-promises
              onClick={finishImportV1}
              className="flex-[2]"
            >
              {submitting ? <Trans>Importing…</Trans> : <Trans>Import v1 keystore</Trans>}
            </Button>
          </div>
        </div>
      )}
    </main>
  )
}

// ───────────────────────────────────────────────────────────────────
// Local helpers — kept in-file because they only make sense for VaultSetup
// ───────────────────────────────────────────────────────────────────

function StepBreadcrumb({ step, total, label }: { step: number; total: number; label: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.10em] text-muted-foreground">
      <span className="tabular-nums">
        <Trans>Step {step.toString()} / {total.toString()}</Trans>
      </span>
      <span className="h-px flex-1 bg-border" />
      <span className="text-primary normal-case tracking-normal font-sans">{label}</span>
    </div>
  )
}

function PathGlyph({ icon }: { icon: React.ReactNode }) {
  return (
    <span className="h-8 w-8 shrink-0 inline-flex items-center justify-center rounded bg-primary/10 text-primary border border-primary/30">
      {icon}
    </span>
  )
}

function SeedSizeRadio({
  active,
  onClick,
  label,
  sub,
}: {
  active: boolean
  onClick: () => void
  label: string
  sub: string
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="radio"
        name="seedSize"
        checked={active}
        onChange={onClick}
        className="accent-primary"
      />
      <span className="font-medium">{label}</span>
      <span className="text-[10px] text-muted-foreground">{sub}</span>
    </label>
  )
}

/**
 * Lightweight strength meter — no zxcvbn dep. Four segments lit by a
 * conservative heuristic (length + class variety). Engineering can swap
 * in zxcvbn-core later if richer scoring is wanted.
 */
function StrengthMeter({ password }: { password: string }) {
  const score = scorePassword(password)
  const labels = ['', 'Weak', 'Fair', 'Strong', 'Excellent'] as const
  const tones = ['', 'text-destructive', 'text-warning', 'text-success', 'text-success'] as const
  const segBgs = ['bg-destructive', 'bg-destructive', 'bg-warning', 'bg-success', 'bg-success'] as const

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className={`h-1 flex-1 rounded-sm ${i <= score ? segBgs[score] : 'bg-border'}`}
          />
        ))}
      </div>
      <div className="flex justify-between text-[10px] font-mono uppercase tracking-[0.08em] text-muted-foreground">
        <span><Trans>Strength</Trans></span>
        <span className={tones[score]}>{labels[score]}</span>
      </div>
    </div>
  )
}

function scorePassword(pw: string): 0 | 1 | 2 | 3 | 4 {
  if (pw.length === 0) return 0
  let s = 0
  if (pw.length >= 8) s++
  if (pw.length >= 12) s++
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].reduce((n, re) => n + (re.test(pw) ? 1 : 0), 0)
  if (classes >= 3) s++
  if (pw.length >= 16 && classes >= 3) s++
  return Math.min(s, 4) as 0 | 1 | 2 | 3 | 4
}

function WordCountStrip({ phrase }: { phrase: string }) {
  const words = phrase.trim().split(/\s+/).filter(Boolean)
  const n = words.length
  const valid = n === 12 || n === 24
  return (
    <div className="flex items-center gap-2 px-2.5 py-1.5 rounded border border-border bg-surface-sunk text-[11px] text-muted-foreground">
      {n === 0 ? (
        <span><Trans>Paste your phrase above.</Trans></span>
      ) : (
        <>
          <span className={valid ? 'text-success' : 'text-warning'}>{valid ? '✓' : '!'}</span>
          <span>
            <Trans>Word count: {n.toString()}</Trans>
          </span>
          {valid && (
            <span className="ml-auto text-[10px] font-mono uppercase tracking-[0.08em] text-success">
              <Trans>length ok</Trans>
            </span>
          )}
        </>
      )}
    </div>
  )
}

function ErrorLine({ text }: { text: string }) {
  return (
    <p className="text-[11px] text-destructive flex items-start gap-1.5">
      <TriangleAlert className="h-3.5 w-3.5 mt-0.5 shrink-0" />
      <span>{text}</span>
    </p>
  )
}
