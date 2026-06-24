import { fromHex } from '@cosmjs/encoding'
import {
  DirectSecp256k1Wallet,
  type OfflineDirectSigner,
} from '@cosmjs/proto-signing'
import { msg } from '@lingui/core/macro'
import { useEffect, useState } from 'react'

import { i18n } from './i18n'
import { useVaultStore, type Vault, type VaultSignerRef } from './vault'
import { deriveAccount } from './vault/seeds'

/** Unification bech32 prefix. Centralised here for the signer hot-path. */
const UNIFICATION_PREFIX = 'und'

// ---------------------------------------------------------------------------
// Pure function — testable without React. The hook below wraps this for
// React consumers; tests target `buildVaultSigner` directly.
//
// Returns the cosmjs `OfflineDirectSigner` for whichever vault entry the ref
// points at, plus the bech32 address it'll sign with. Throws clear errors if
// the ref dangles (entry was deleted) or the seed lacks the requested account.
//
// `OfflineDirectSigner` is the cosmjs abstract interface used everywhere by
// `SigningStargateClient.signAndBroadcast`. In M2, Keplr/Leap/Cosmostation
// signers slot into the same return shape — every Tx-submitting flow from
// M3 onwards consumes this interface, no code-paths diverge by signer source.
// ---------------------------------------------------------------------------

export interface VaultSigner {
  signer: OfflineDirectSigner
  address: string
}

export async function buildVaultSigner(
  vault: Vault,
  ref: VaultSignerRef,
): Promise<VaultSigner> {
  if (ref.kind === 'vault-seed') {
    const seed = vault.seeds.find((s) => s.id === ref.seedId)
    if (!seed) throw new Error(i18n._(msg`seed ${ref.seedId} not found in vault`))
    const accountEntry = seed.accounts.find((a) => a.index === ref.accountIndex)
    if (!accountEntry) {
      throw new Error(
        i18n._(
          msg`account index ${ref.accountIndex.toString()} not found in seed ${ref.seedId}`,
        ),
      )
    }
    const derived = await deriveAccount(seed.mnemonic, ref.accountIndex)
    // typescript-eslint's projectService doesn't resolve fromHex's return type
    // (same friction as in seeds.ts / v1-keystore.ts). `: Uint8Array` annotation
    // pins the type; tsc + tests verify correctness.
    /* eslint-disable @typescript-eslint/no-unsafe-assignment */
    const privkey: Uint8Array = fromHex(derived.privateKey)
    /* eslint-enable @typescript-eslint/no-unsafe-assignment */
    const signer = await DirectSecp256k1Wallet.fromKey(privkey, UNIFICATION_PREFIX)
    return { signer, address: derived.address }
  }

  // vault-imported (single private key — typically a v1 JSON keystore import).
  const entry = vault.importedKeys.find((k) => k.id === ref.id)
  if (!entry) throw new Error(i18n._(msg`imported key ${ref.id} not found in vault`))
  /* eslint-disable @typescript-eslint/no-unsafe-assignment */
  const privkey: Uint8Array = fromHex(entry.privateKey)
  /* eslint-enable @typescript-eslint/no-unsafe-assignment */
  const signer = await DirectSecp256k1Wallet.fromKey(privkey, UNIFICATION_PREFIX)
  return { signer, address: entry.address }
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

export interface UseActiveSignerResult {
  signer: OfflineDirectSigner | null
  address: string | null
  loading: boolean
  error: Error | null
}

/**
 * React hook that exposes the active signer for the unlocked vault.
 *
 * Returns `{ signer: null, address: null }` when the vault is locked / there
 * is no active signer ref / the ref points at a missing entry (loading +
 * error reflect the latter). Async-rebuilds the signer when the active ref
 * or its underlying vault data changes.
 */
export function useActiveSigner(): UseActiveSignerResult {
  const status = useVaultStore((s) => s.status)
  const vault = useVaultStore((s) => s.vault)
  const ref = vault?.preferences.activeSignerRef

  const [signer, setSigner] = useState<OfflineDirectSigner | null>(null)
  const [address, setAddress] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (status !== 'unlocked' || !vault || !ref) {
      setSigner(null)
      setAddress(null)
      setError(null)
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    buildVaultSigner(vault, ref)
      .then((result) => {
        if (cancelled) return
        setSigner(result.signer)
        setAddress(result.address)
        setLoading(false)
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setSigner(null)
        setAddress(null)
        setError(e instanceof Error ? e : new Error(String(e)))
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [status, vault, ref])

  return { signer, address, loading, error }
}

/**
 * Human-readable label for the active signer, e.g. `"Seed 1 / Account 1"`
 * or `"Imported 1"`. Returns null when the vault is locked / there's no
 * active signer ref. Used by the header so the user can recognise which
 * account they're acting on without parsing the truncated address chip.
 */
export function useActiveSignerLabel(): string | null {
  const vault = useVaultStore((s) => s.vault)
  const ref = vault?.preferences.activeSignerRef
  if (!vault || !ref) return null
  if (ref.kind === 'vault-seed') {
    const seed = vault.seeds.find((s) => s.id === ref.seedId)
    const account = seed?.accounts.find((a) => a.index === ref.accountIndex)
    if (!seed || !account) return null
    return `${seed.label} / ${account.label}`
  }
  // ref.kind === 'vault-imported'
  const imported = vault.importedKeys.find((k) => k.id === ref.id)
  return imported?.label ?? null
}
