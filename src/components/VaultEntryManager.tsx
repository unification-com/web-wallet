import { Check, Pencil, Trash2, X } from 'lucide-react'
import { useState, type ReactNode } from 'react'

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
export function VaultEntryManager() {
  const seeds = useVaultStore((s) => s.vault?.seeds ?? [])
  const importedKeys = useVaultStore((s) => s.vault?.importedKeys ?? [])

  return (
    <Card>
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-sm">Vault entries</CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-2 flex flex-col gap-4 text-xs">
        {seeds.length === 0 && importedKeys.length === 0 && (
          <p className="text-muted-foreground italic">
            No seeds or imported keys yet — head back to setup to add one.
          </p>
        )}

        {seeds.map((seed) => (
          <SeedRow key={seed.id} seed={seed} />
        ))}

        {importedKeys.length > 0 && (
          <section className="flex flex-col gap-2 border-t pt-3">
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Imported keys
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
  const [value, setValue] = useState(current)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async () => {
    if (!value.trim()) {
      setError('label is required')
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
        title="Save"
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
        title="Cancel"
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
            Cancel
          </Button>
          <Button
            variant="destructive"
            size="sm"
            disabled={busy}
            // eslint-disable-next-line @typescript-eslint/no-misused-promises
            onClick={onConfirm}
          >
            {busy ? 'Deleting…' : 'Delete'}
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

  const [renaming, setRenaming] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

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
                {seed.accounts.length} account{seed.accounts.length === 1 ? '' : 's'}
              </span>
            </div>
            <div className="flex gap-0.5">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setRenaming(true)}
                title="Rename seed"
              >
                <Pencil className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-destructive"
                onClick={() => setConfirmDelete(true)}
                title="Delete seed"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </>
        )}
      </header>
      <ul className="flex flex-col gap-1 pl-2">
        {seed.accounts.map((a) => (
          <AccountRow key={a.index} seedId={seed.id} account={a} />
        ))}
      </ul>
      <ConfirmDelete
        open={confirmDelete}
        title={`Delete "${seed.label}"?`}
        description={
          <>
            All {seed.accounts.length} derived account
            {seed.accounts.length === 1 ? '' : 's'} will be removed from the vault.
          </>
        }
        warning="The seed mnemonic is NOT stored elsewhere. If you do not have it written down, the funds in any derived account will be unrecoverable."
        busy={deleting}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={onDelete}
      />
    </section>
  )
}

function AccountRow({ seedId, account }: { seedId: string; account: SeedAccount }) {
  const renameSeedAccount = useVaultStore((s) => s.renameSeedAccount)
  const [renaming, setRenaming] = useState(false)

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
            <span className="font-mono text-[10px] text-muted-foreground truncate">
              {account.address}
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setRenaming(true)}
            title="Rename account"
          >
            <Pencil className="h-3 w-3" />
          </Button>
        </>
      )}
    </li>
  )
}

// ---------------------------------------------------------------------------
// Imported key row
// ---------------------------------------------------------------------------

function ImportedKeyRow({ entry }: { entry: ImportedKeyEntry }) {
  const renameImportedKey = useVaultStore((s) => s.renameImportedKey)
  const removeImportedKey = useVaultStore((s) => s.removeImportedKey)

  const [renaming, setRenaming] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

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
            <span className="font-mono text-[10px] text-muted-foreground truncate">
              {entry.address}
            </span>
          </div>
          <div className="flex gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setRenaming(true)}
              title="Rename key"
            >
              <Pencil className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-destructive"
              onClick={() => setConfirmDelete(true)}
              title="Delete key"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </>
      )}
      <ConfirmDelete
        open={confirmDelete}
        title={`Delete "${entry.label}"?`}
        description={<>The private key will be removed from the vault.</>}
        warning="The private key is NOT stored elsewhere. If you do not have a backup of the original v1 JSON file (or an export), funds at this address will be unrecoverable."
        busy={deleting}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={onDelete}
      />
    </li>
  )
}
