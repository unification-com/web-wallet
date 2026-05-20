import { Plus, Wallet } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { useActiveSigner } from '@/lib/signer'
import { useVaultStore } from '@/lib/vault'
import type { VaultSignerRef } from '@/lib/vault/types'

function truncate(addr: string, head = 8, tail = 6): string {
  return addr.length <= head + tail + 3 ? addr : `${addr.slice(0, head)}…${addr.slice(-tail)}`
}

function isActive(active: VaultSignerRef | undefined, ref: VaultSignerRef): boolean {
  if (active?.kind !== ref.kind) return false
  if (active.kind === 'vault-seed' && ref.kind === 'vault-seed') {
    return active.seedId === ref.seedId && active.accountIndex === ref.accountIndex
  }
  if (active.kind === 'vault-imported' && ref.kind === 'vault-imported') {
    return active.id === ref.id
  }
  return false
}

/**
 * Header-anchored Dialog listing every signer in the vault — per-seed account
 * groups plus imported keys. Click to switch active signer. Per-seed "Add
 * account" button derives the next HD index via `addAccountToSeed`. Rename
 * + delete affordances deferred to a focused follow-up.
 */
export function AccountSwitcher() {
  const { address } = useActiveSigner()
  const seeds = useVaultStore((s) => s.vault?.seeds ?? [])
  const importedKeys = useVaultStore((s) => s.vault?.importedKeys ?? [])
  const activeRef = useVaultStore((s) => s.vault?.preferences.activeSignerRef)
  const setActiveSigner = useVaultStore((s) => s.setActiveSigner)
  const addAccountToSeed = useVaultStore((s) => s.addAccountToSeed)

  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const switchTo = async (ref: VaultSignerRef) => {
    setError(null)
    try {
      await setActiveSigner(ref)
      setOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const addAccount = async (seedId: string) => {
    setError(null)
    setBusy(seedId)
    try {
      const account = await addAccountToSeed(seedId)
      // Activate the freshly derived account so the user lands ready-to-use.
      await setActiveSigner({ kind: 'vault-seed', seedId, accountIndex: account.index })
      setOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(null)
    }
  }

  if (!address) return null

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="font-mono text-xs h-7 px-2"
          title={`${address} — click to switch account`}
        >
          {truncate(address)}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Accounts</DialogTitle>
          <DialogDescription>
            Switch between accounts derived from your seeds or imported keys.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="text-xs text-destructive rounded border border-destructive/30 bg-destructive/5 p-2">
            {error}
          </div>
        )}

        <div className="flex flex-col gap-4 max-h-[60vh] overflow-y-auto">
          {seeds.map((seed) => (
            <section key={seed.id} className="flex flex-col gap-1">
              <header className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {seed.label}
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  disabled={busy === seed.id}
                  // eslint-disable-next-line @typescript-eslint/no-misused-promises
                  onClick={() => addAccount(seed.id)}
                >
                  <Plus className="h-3 w-3" />
                  {busy === seed.id ? 'Adding…' : 'Add account'}
                </Button>
              </header>
              <ul className="flex flex-col gap-1">
                {seed.accounts.map((a) => {
                  const ref: VaultSignerRef = {
                    kind: 'vault-seed',
                    seedId: seed.id,
                    accountIndex: a.index,
                  }
                  const active = isActive(activeRef, ref)
                  return (
                    <li key={a.index}>
                      <button
                        type="button"
                        // eslint-disable-next-line @typescript-eslint/no-misused-promises
                        onClick={() => switchTo(ref)}
                        className={
                          'w-full flex items-center justify-between gap-2 rounded border p-2 text-left text-xs hover:bg-accent ' +
                          (active ? 'border-primary bg-primary/5' : 'border-border')
                        }
                      >
                        <span className="flex flex-col">
                          <span className="font-medium">{a.label}</span>
                          <span className="font-mono text-[10px] text-muted-foreground">
                            {a.address}
                          </span>
                        </span>
                        {active && <span className="text-primary text-[10px] font-medium">ACTIVE</span>}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}

          {importedKeys.length > 0 && (
            <section className="flex flex-col gap-1">
              <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                <Wallet className="h-3 w-3" />
                Imported keys
              </h3>
              <ul className="flex flex-col gap-1">
                {importedKeys.map((k) => {
                  const ref: VaultSignerRef = { kind: 'vault-imported', id: k.id }
                  const active = isActive(activeRef, ref)
                  return (
                    <li key={k.id}>
                      <button
                        type="button"
                        // eslint-disable-next-line @typescript-eslint/no-misused-promises
                        onClick={() => switchTo(ref)}
                        className={
                          'w-full flex items-center justify-between gap-2 rounded border p-2 text-left text-xs hover:bg-accent ' +
                          (active ? 'border-primary bg-primary/5' : 'border-border')
                        }
                      >
                        <span className="flex flex-col">
                          <span className="font-medium">{k.label}</span>
                          <span className="font-mono text-[10px] text-muted-foreground">
                            {k.address}
                          </span>
                        </span>
                        {active && <span className="text-primary text-[10px] font-medium">ACTIVE</span>}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </section>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
