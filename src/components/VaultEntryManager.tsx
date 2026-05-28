import { Trans, useLingui } from '@lingui/react/macro'
import { Check, Eye, KeyRound, Pencil, Trash2, X } from 'lucide-react'
import { useState, type ReactNode } from 'react'

import { AddressLink } from '@/components/AddressLink'
import { AddSignerCard } from '@/components/AddSignerCard'
import { RevealSecretDialog, type RevealedSecret } from '@/components/RevealSecretDialog'
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
import { useVaultStore } from '@/lib/vault'
import { deriveAccount } from '@/lib/vault/seeds'
import type { ImportedKeyEntry, SeedAccount, SeedEntry } from '@/lib/vault/types'

/**
 * Vault-entry management surface inside Settings — rename + delete for
 * seeds, accounts-within-seeds, and imported keys.
 *
 * Delete is destructive: seed mnemonics are not recoverable from the vault
 * once removed, and active signers pointing at deleted entries get cleared
 * (handled atomically inside the store actions). Confirm Dialog is mandatory
 * for every delete path.
 */
export function VaultEntryManager({
  surface,
}: {
  surface: 'popup' | 'standalone' | 'web'
}) {
  const seeds = useVaultStore((s) => s.vault?.seeds ?? [])
  const importedKeys = useVaultStore((s) => s.vault?.importedKeys ?? [])

  return (
    <div className="flex flex-col gap-4">
      <AddSignerCard surface={surface} />
      <Card>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm">
            <Trans>Vault entries</Trans>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-2 flex flex-col gap-4 text-xs">
          {seeds.length === 0 && importedKeys.length === 0 && (
            <p className="text-muted-foreground italic">
              <Trans>No seeds or imported keys yet — use Add another above to start.</Trans>
            </p>
          )}

          {seeds.map((seed) => (
            <SeedRow key={seed.id} seed={seed} />
          ))}

          {importedKeys.length > 0 && (
            <section className="flex flex-col gap-2 border-t pt-3">
              <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <Trans>Imported keys</Trans>
              </h3>
              <ul className="flex flex-col gap-1">
                {importedKeys.map((k) => (
                  <ImportedKeyRow key={k.id} entry={k} />
                ))}
              </ul>
            </section>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Inline rename — shared shape for every entity type
// ---------------------------------------------------------------------------

function InlineRename({
  current,
  onSave,
  onCancel,
}: {
  current: string
  onSave: (next: string) => Promise<void>
  onCancel: () => void
}) {
  const { t } = useLingui()
  const [value, setValue] = useState(current)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async () => {
    if (!value.trim()) {
      setError(t`label is required`)
      return
    }
    setBusy(true)
    try {
      await onSave(value.trim())
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex items-center gap-1 flex-1">
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void save()
          if (e.key === 'Escape') onCancel()
        }}
        aria-label={t`New name`}
        // eslint-disable-next-line jsx-a11y/no-autofocus -- intentional: focus the rename input on open
        autoFocus
        disabled={busy}
        className="h-7 text-xs"
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        disabled={busy}
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        onClick={save}
        title={t`Save`}
        aria-label={t`Save`}
      >
        <Check className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        disabled={busy}
        onClick={onCancel}
        title={t`Cancel`}
        aria-label={t`Cancel`}
      >
        <X className="h-3.5 w-3.5" />
      </Button>
      {error && <span className="text-destructive text-[10px]">{error}</span>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Confirm-delete Dialog — shared shape
// ---------------------------------------------------------------------------

function ConfirmDelete({
  open,
  title,
  description,
  warning,
  busy,
  onCancel,
  onConfirm,
}: {
  open: boolean
  title: string
  description: ReactNode
  warning: string
  busy: boolean
  onCancel: () => void
  onConfirm: () => Promise<void>
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && !busy && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="rounded border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
          {warning}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" disabled={busy} onClick={onCancel}>
            <Trans>Cancel</Trans>
          </Button>
          <Button
            variant="destructive"
            size="sm"
            disabled={busy}
            // eslint-disable-next-line @typescript-eslint/no-misused-promises
            onClick={onConfirm}
          >
            {busy ? <Trans>Deleting…</Trans> : <Trans>Delete</Trans>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Seed row (with nested account rows)
// ---------------------------------------------------------------------------

function SeedRow({ seed }: { seed: SeedEntry }) {
  const renameSeed = useVaultStore((s) => s.renameSeed)
  const removeSeed = useVaultStore((s) => s.removeSeed)
  const { t } = useLingui()

  const [renaming, setRenaming] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [revealOpen, setRevealOpen] = useState(false)

  const onDelete = async () => {
    setDeleting(true)
    try {
      await removeSeed(seed.id)
      setConfirmDelete(false)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <section className="flex flex-col gap-1 border rounded p-2">
      <header className="flex items-center justify-between gap-2">
        {renaming ? (
          <InlineRename
            current={seed.label}
            onSave={async (next) => {
              await renameSeed(seed.id, next)
              setRenaming(false)
            }}
            onCancel={() => setRenaming(false)}
          />
        ) : (
          <>
            <div className="flex flex-col">
              <span className="text-xs font-medium">{seed.label}</span>
              <span className="text-[10px] text-muted-foreground">
                <Trans>
                  {seed.accounts.length} account{seed.accounts.length === 1 ? '' : 's'}
                </Trans>
              </span>
            </div>
            <div className="flex gap-0.5">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setRevealOpen(true)}
                title={t`Reveal seed phrase`}
                aria-label={t`Reveal seed phrase`}
              >
                <Eye className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setRenaming(true)}
                title={t`Rename seed`}
                aria-label={t`Rename seed`}
              >
                <Pencil className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-destructive"
                onClick={() => setConfirmDelete(true)}
                title={t`Delete seed`}
                aria-label={t`Delete seed`}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </>
        )}
      </header>
      <ul className="flex flex-col gap-1 pl-2">
        {seed.accounts.map((a) => (
          <AccountRow key={a.index} seedId={seed.id} mnemonic={seed.mnemonic} account={a} />
        ))}
      </ul>
      <ConfirmDelete
        open={confirmDelete}
        title={t`Delete "${seed.label}"?`}
        description={
          <Trans>
            All {seed.accounts.length} derived account
            {seed.accounts.length === 1 ? '' : 's'} will be removed from the vault.
          </Trans>
        }
        warning={t`The seed mnemonic is NOT stored elsewhere. If you do not have it written down, the funds in any derived account will be unrecoverable.`}
        busy={deleting}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={onDelete}
      />
      <RevealSecretDialog
        open={revealOpen}
        onClose={() => setRevealOpen(false)}
        title={<Trans>{seed.label} — seed phrase</Trans>}
        preRevealDescription={
          <Trans>Re-enter your wallet password to reveal the seed phrase.</Trans>
        }
        postRevealDescription={
          <Trans>
            Write these words down somewhere safe. Anyone with this phrase can spend
            funds at any account derived from this seed.
          </Trans>
        }
        warningContent={
          <Trans>
            Do not share. Do not screenshot. The seed gives full control of every
            account derived from it.
          </Trans>
        }
        resolveSecret={() =>
          Promise.resolve({
            copyText: seed.mnemonic,
            display: <MnemonicGrid mnemonic={seed.mnemonic} />,
          })
        }
        copyLabel={<Trans>Copy phrase</Trans>}
      />
    </section>
  )
}

// ---------------------------------------------------------------------------
// Secret-content display helpers — DRY across mnemonic + private-key reveals
// ---------------------------------------------------------------------------

function MnemonicGrid({ mnemonic }: { mnemonic: string }) {
  return (
    <ol className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs font-mono rounded border bg-muted p-3">
      {mnemonic.split(' ').map((word, i) => (
        <li key={`${i.toString()}-${word}`} className="flex gap-2">
          <span className="text-muted-foreground w-6 text-right">{i + 1}.</span>
          <span>{word}</span>
        </li>
      ))}
    </ol>
  )
}

function PrivateKeyBlock({ hex }: { hex: string }) {
  return (
    <pre className="text-xs font-mono rounded border bg-muted p-3 break-all whitespace-pre-wrap">
      {hex}
    </pre>
  )
}

function AccountRow({
  seedId,
  mnemonic,
  account,
}: {
  seedId: string
  mnemonic: string
  account: SeedAccount
}) {
  const renameSeedAccount = useVaultStore((s) => s.renameSeedAccount)
  const { t } = useLingui()
  const [renaming, setRenaming] = useState(false)
  const [revealKeyOpen, setRevealKeyOpen] = useState(false)

  return (
    <li className="flex items-center justify-between gap-1 text-xs">
      {renaming ? (
        <InlineRename
          current={account.label}
          onSave={async (next) => {
            await renameSeedAccount(seedId, account.index, next)
            setRenaming(false)
          }}
          onCancel={() => setRenaming(false)}
        />
      ) : (
        <>
          <div className="flex flex-col flex-1 min-w-0">
            <span className="font-medium">{account.label}</span>
            <AddressLink
              address={account.address}
              className="text-[10px] text-muted-foreground truncate"
            />
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setRevealKeyOpen(true)}
            title={t`Reveal private key`}
            aria-label={t`Reveal private key for ${account.label}`}
          >
            <KeyRound className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setRenaming(true)}
            title={t`Rename account`}
            aria-label={t`Rename account ${account.label}`}
          >
            <Pencil className="h-3 w-3" />
          </Button>
        </>
      )}
      <RevealSecretDialog
        open={revealKeyOpen}
        onClose={() => setRevealKeyOpen(false)}
        title={<Trans>{account.label} — private key</Trans>}
        preRevealDescription={
          <Trans>
            Re-enter your wallet password to reveal the private key for this account. It
            will be derived from the seed at HD index #{account.index.toString()}.
          </Trans>
        }
        postRevealDescription={
          <Trans>
            Import this hex-encoded key into another wallet (Keplr, Leap, …) to access
            this account elsewhere. The corresponding address is{' '}
            <span className="font-mono">{account.address}</span>.
          </Trans>
        }
        warningContent={
          <Trans>
            Do not share. Do not screenshot. Anyone with this private key can spend funds
            held at this address.
          </Trans>
        }
        resolveSecret={async (): Promise<RevealedSecret> => {
          const derived = await deriveAccount(mnemonic, account.index)
          return {
            copyText: derived.privateKey,
            display: <PrivateKeyBlock hex={derived.privateKey} />,
          }
        }}
        copyLabel={<Trans>Copy key</Trans>}
      />
    </li>
  )
}

// ---------------------------------------------------------------------------
// Imported key row
// ---------------------------------------------------------------------------

function ImportedKeyRow({ entry }: { entry: ImportedKeyEntry }) {
  const renameImportedKey = useVaultStore((s) => s.renameImportedKey)
  const removeImportedKey = useVaultStore((s) => s.removeImportedKey)
  const { t } = useLingui()

  const [renaming, setRenaming] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [revealKeyOpen, setRevealKeyOpen] = useState(false)

  const onDelete = async () => {
    setDeleting(true)
    try {
      await removeImportedKey(entry.id)
      setConfirmDelete(false)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <li className="flex items-center justify-between gap-1 border rounded p-2">
      {renaming ? (
        <InlineRename
          current={entry.label}
          onSave={async (next) => {
            await renameImportedKey(entry.id, next)
            setRenaming(false)
          }}
          onCancel={() => setRenaming(false)}
        />
      ) : (
        <>
          <div className="flex flex-col flex-1 min-w-0">
            <span className="text-xs font-medium">{entry.label}</span>
            <AddressLink
              address={entry.address}
              className="text-[10px] text-muted-foreground truncate"
            />
          </div>
          <div className="flex gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setRevealKeyOpen(true)}
              title={t`Reveal private key`}
              aria-label={t`Reveal private key for ${entry.label}`}
            >
              <KeyRound className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setRenaming(true)}
              title={t`Rename key`}
              aria-label={t`Rename key ${entry.label}`}
            >
              <Pencil className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-destructive"
              onClick={() => setConfirmDelete(true)}
              title={t`Delete key`}
              aria-label={t`Delete key ${entry.label}`}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </>
      )}
      <ConfirmDelete
        open={confirmDelete}
        title={t`Delete "${entry.label}"?`}
        description={<Trans>The private key will be removed from the vault.</Trans>}
        warning={t`The private key is NOT stored elsewhere. If you do not have a backup of the original v1 JSON file (or an export), funds at this address will be unrecoverable.`}
        busy={deleting}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={onDelete}
      />
      <RevealSecretDialog
        open={revealKeyOpen}
        onClose={() => setRevealKeyOpen(false)}
        title={<Trans>{entry.label} — private key</Trans>}
        preRevealDescription={
          <Trans>Re-enter your wallet password to reveal the private key.</Trans>
        }
        postRevealDescription={
          <Trans>
            Import this hex-encoded key into another wallet (Keplr, Leap, …) to access
            this account elsewhere. The corresponding address is{' '}
            <span className="font-mono">{entry.address}</span>.
          </Trans>
        }
        warningContent={
          <Trans>
            Do not share. Do not screenshot. Anyone with this private key can spend funds
            held at this address.
          </Trans>
        }
        resolveSecret={() =>
          Promise.resolve({
            copyText: entry.privateKey,
            display: <PrivateKeyBlock hex={entry.privateKey} />,
          })
        }
        copyLabel={<Trans>Copy key</Trans>}
      />
    </li>
  )
}
